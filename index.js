const { EventEmitter } = require('events');
const assert = require('assert');
const debug = require('debug')('cicp:magicMatcher');

class MagicMatcher extends EventEmitter {
  /**
   *
   * @constructor
   */
  constructor({ matcher, configLoader }) {
    super();
    debug('constructor');

    assert(matcher, 'Matcher must be present');
    this.matcher = matcher;
    assert(configLoader, 'ConfigLoader must be present');
    this.configLoader = configLoader;
  }

  /**
   * Set additional properties after object constructor
   *
   * @param {{logger: object}} param Additional Object
   */
  setInitialProperties({ logger, util }) {
    assert(logger, 'Logger must be present');
    this.logger = logger;
    assert(util, 'Util must be present');
    this.util = util;
  }

  option() {
    return {
      command: {
        short: 'm',
        long: 'magic',
        parameters: '<srcConfig>,<cloneConfig>',
      },
      description: 'Compare two recording and auto-populate matcher/ignore object',
      callback: (args) => {
        debug('MagicMatcher', args);
        const paths = args[0].split(',');
        this.compareConfig({
          src: paths[0],
          dest: paths[1],
        });
      },
    };
  }

  compareConfig({ src, dest }) {
    debug('compareConfig', src, dest);
    const newRecordSet = `${src}-Moded`;
    let magicUsed = false;

    this.configLoader.loadConfig(src);
    this.configLoader.loadConfig(dest);

    const srcRequests = this.matcher.getRequests(src);
    const destRequests = this.matcher.getRequests(dest);

    const newRequests = srcRequests.map((request) => {
      const perfectMatch = this.getPerfectMatches(request, destRequests, true);

      // Try to do magic if not found
      if (perfectMatch.length === 0) {
        debug('Magic needed!');
        magicUsed = true;

        const closeMatches = destRequests.filter(closeRequest => closeRequest.req.method === request.req.method
          && closeRequest.req.urlParse.protocol === request.req.urlParse.protocol
          && closeRequest.req.urlParse.host === request.req.urlParse.host
          && closeRequest.req.urlParse.pathname === request.req.urlParse.pathname
          && closeRequest.req.headers.referer === request.req.headers.referer
          && closeRequest.res.statusCode === request.res.statusCode);

        debug('closeMatches', closeMatches.length);

        if (closeMatches.length === 0) {
          this.logger.warn('Can not do magic...');
          return request;
        }

        const fullMatcher = this.util.cloneDeep(request.general.matcher);
        let urlParse;
        let body;
        let headers;

        if (!this.util.isEmptyObject(request.req.urlParse.query)) {
          urlParse = true;
          // Handle Request query params
          debug('Query param to check');
          delete fullMatcher.match.url;
          fullMatcher.match.urlParse = {
            protocol: true,
            host: true,
            pathname: true,
            query: {},
          };
          Object.keys(request.req.urlParse.query).forEach((key) => {
            fullMatcher.match.urlParse.query[key] = true;
          });
        }

        if (!this.util.isEmptyObject(request.req.body)) {
          body = true;
          // Handle Request body
          debug('Body to check');
          // TODO: Build matcher rules
        }

        if (!this.util.isEmptyObject(request.req.headers)) {
          headers = true;
          // Handle Request headers
          debug('Headers to check');
          // TODO: Build Headers rules
        }

        debug('final', fullMatcher);

        const allMatchers = this._generateMatchers(fullMatcher, { urlParse, body, headers });
        debug(`Generate ${allMatchers.length} matchers`);

        const allCombinaisons = this._generateAllCombinaison(allMatchers);
        debug(`Testing all ${allCombinaisons.length} combinaisons`);

        for (let i = 0, l = allCombinaisons.length; i < l; i++) {
          debug(`testing combinaison ${i}`, allCombinaisons[i]);

          const buildedMatcher = this.buildFromCombinaison(request.general.matcher, allCombinaisons[i], allMatchers);
          const modedRequest = this.modRequest(request, buildedMatcher);
          const possibleMatches = this.getPerfectMatches(modedRequest, this.util.cloneDeep(closeMatches), true);

          if (possibleMatches.length === 1) {
            debug(`Yeah you found it #${i}!!!!`, modedRequest.general.matcher);
            // Update request for matching
            request.general.matcher = modedRequest.general.matcher;

            // We found the first one then we stop
            return request;
          }
          debug('Current possible matches', possibleMatches.length);
        }
      }

      return request;
    });

    this.matcher.setRequests(newRecordSet, newRequests);
    if (!magicUsed) {
      debug('Magic has not been used because everything is matching!');
    }
    this.configLoader.saveConfig(newRecordSet);
  }

  /**
   * Build the new matcher rules
   *
   * @param {Object} matcher Base matcher to amend
   * @param {String} selectedFields Add fields to matcher or ignore (space separated)
   * @param {Array<String>} allMatchers All possible case for parameters (to decide either ignore or match)
   */
  buildFromCombinaison(matcher, selectedFields, allMatchers) {
    const clonedMatcher = this.util.cloneDeep(matcher);
    if (!clonedMatcher.match) {
      clonedMatcher.match = {};
    }
    if (!clonedMatcher.ignore) {
      clonedMatcher.ignore = {};
    }

    if (selectedFields.indexOf('urlParse') !== -1) {
      delete clonedMatcher.match.url;
    }
    if (selectedFields.indexOf('body') !== -1) {
      delete clonedMatcher.match.rawBody;
    }

    const listFields = selectedFields.split(' ');
    // TODO: Handle multiple . separated
    const isIgnored = listFields.length < allMatchers.length / 2;

    for (let i = 0, l = listFields.length; i < l; i++) {
      const fields = listFields[i].split('.');

      let baseField = clonedMatcher.match;
      for (let j = 0, k = fields.length - 1; j < k; j++) {
        if (!baseField[fields[j]]) {
          baseField[fields[j]] = {};
        }
        baseField = baseField[fields[j]];
      }
      if (fields[fields.length - 1] !== '') {
        baseField[fields[fields.length - 1]] = true;
      }
    }

    // Cleanup
    if (this.util.isEmptyObject(clonedMatcher.match.urlParse.query)) {
      delete clonedMatcher.match.urlParse.query;
    }
    if (this.util.isEmptyObject(clonedMatcher.match.urlParse)) {
      delete clonedMatcher.match.urlParse;
    }
    if (this.util.isEmptyObject(clonedMatcher.match.body)) {
      delete clonedMatcher.match.body;
    }
    if (this.util.isEmptyObject(clonedMatcher.match)) {
      delete clonedMatcher.match;
    }
    if (this.util.isEmptyObject(clonedMatcher.ignore)) {
      delete clonedMatcher.ignore;
    }

    return { general: { matcher: clonedMatcher } };
  }

  /**
   * Mod a request to replace its matcher
   *
   * @param {*} request Base request
   * @param {*} matcher New matcher for this request
   */
  modRequest(request, matcher) {
    const modedRequest = this.util.cloneDeep(request);
    const copyMatcher = this.util.cloneDeep(matcher);

    modedRequest.general.matcher = copyMatcher.general.matcher;
    return modedRequest;
  }

  /**
   * Return an array of all perfect match for a give request
   *
   * @param {*} request Given request to look into destRequests
   * @param {Array} destRequests Array of requests
   * @param {Boolean} basedOnRequest Tell if we should use the request matcher or not (default false)
   */
  getPerfectMatches(request, destRequests, basedOnRequest = false) {
    const requestLight = this.matcher.buildObjectFromMatcher(request.general.matcher, request.req);

    const perfectMatch = destRequests.filter((obj) => {
      const objLight = this.matcher.buildObjectFromMatcher(basedOnRequest ? request.general.matcher : obj.general.matcher, obj.req);
      return this.util.compareObject(objLight, requestLight);
    });

    return perfectMatch;
  }

  /**
   * Generate all matcher for various fields
   *
   * @param {*} matchers
   * @param {*} param1
   */
  _generateMatchers(baseMatcher, { urlParse, body, headers }) {
    debug('_generateMatchers');

    const fields = {
      urlParse: [],
      body: [],
      headers: [],
    };

    if (urlParse) {
      Object.keys(baseMatcher.match.urlParse).forEach((key) => {
        if (key !== 'query') {
          fields.urlParse.push(`urlParse.${key}`);
        }
      });
      Object.keys(baseMatcher.match.urlParse.query).forEach((key) => {
        fields.urlParse.push(`urlParse.query.${key}`);
      });
      fields.urlParse.push('urlParse.query.');
    }
    // TODO: Do it for body and headers
    // Note : For body, test if it's object and them add multiple entry body.foo.bar for example

    return [].concat(fields.urlParse, fields.body, fields.headers);
  }

  _generateAllCombinaison(array) {
    function combinationUtil(arr, data, start, end, index, r, answer) {
      if (index === r) {
        const result = [];
        for (let j = 0; j < r; j++) {
          result.push(data[j]);
        }
        answer.push(result.join(' '));
        return null;
      }

      for (let i = start; i <= end && ((end - i) + 1) >= r - index; i++) {
        data[index] = arr[i]; // eslint-disable-line no-param-reassign
        combinationUtil(arr, data, i + 1, end, index + 1, r, answer);
      }

      return answer;
    }

    function printCombination(arr, n, r) {
      const data = [];

      const answer = combinationUtil(arr, data, 0, n - 1, 0, r, []);
      return answer;
    }

    // Driver Code
    const n = array.length;
    let res = [];

    for (let i = array.length; i > 0; i--) {
      res = res.concat(printCombination(array, n, i));
    }

    return res;
  }
}

module.exports = function setup(options, imports, register) {
  const magicMatcher = new MagicMatcher(imports);

  register(null, {
    magicMatcher,
  });
};
