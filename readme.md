# Magic Matcher (CICP Plugin)

This CICP plugin allows you to compare two recordset and automatically build the matcher properties.  
It should be used with `configLoader` or equivalent and `matcher`.


# How to use it

## Add it to CICP

Install it to your `plugins` folder, then do not forget to add it while launching the cli: `cicp -o configLoader,matcher,magicMatcher`.   

## Require this plugin from another

Simply add the following object in your `package.json`:

```json
"plugin": {
  "consumes": [
    "magicMatcher",
  ],
}
```

## Comandline option

This plugin add a new commandline switch `-pm` or `--plug-magic`.  
It accept two parameters, comma separated, `srcConfig` & `cloneConfig`.

Here is an example:  
`cicp --plug-magic 'recordset1,recordset2'`.

# Additional Informations

This plugin will generate another recordset with a suffix of `-Moded`.

This module use `DEBUG` so feel free to add `DEBUG=cicp:magicMatcher` to see debug logs.

# License

```
Copyright (c) 2019 Rémy Boulanouar

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:



The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.



THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.  IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
```