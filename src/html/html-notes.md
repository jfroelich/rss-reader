
# truncate_html issues

* Using the native parsing is lossy because of encoding. Certain entities like
&amp;#32; are decoded back into spaces. I would prefer a lossless transform.
* I do not love how how the parameters are different. The input string is
assumed to be encoded (containing entities) but the extension string must be
decoded (because it is encoded when used)
* I do not like how I have to do a regex test at the end of the function, this
is yet another pass over the input. I would prefer a single pass algorithm.
* I do not like how using the native parser at all is basically an XSS issue.
It feels like there is a better approach that avoids XSS issues.
* Using let/const caused deopt warnings about "unsupported phi use of const" in
Chrome 55. This may no longer be an issue and I would prefer to use a consistent
declaration style.
* Double check the behavior of setting nodeValue or reading nodeValue. Clearly
understand how it encodes or decodes implicitly.
* There is an issue with truncation when the input string contains entities
because of the implicit decoding that occurs. The truncation position is
inaccurate. This currently truncates the decoded position, which is different
than the nearest legal position in the encoded raw input.
* If tokenize_html is implemented, this should probably switch to that and
avoid using native parsing. This avoids the lossy issue, and possibly avoids
the inaccurate position issue.
* Write tests

# replace_html issues

* Consider allowing certain tags when replacing html tags in a string. Maybe
accept a whitelist of tags to keep in the output. This might promote more reuse.
* Switch to using tokenize_html instead of native parser once it settles
* Write tests
