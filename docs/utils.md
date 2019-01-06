# truncate_html
Similar to string truncation, but takes care not to truncate a string within the middle of an html tag or entity. The position is the position within the string in which to truncate. This position is based on the pure text offset (as if no tags existed), not the actual offset in the html string. May be an issue with how offset relates to entities, forgot what I did there. This is currently a very expensive operation. The document is parsed fully into a DOM, then the DOM is manipulated and then serialized back into an html string.

Due to using DOMParser, this has no great way of knowing whether the original input html string was a fragment or a full document, so it uses a hack by looking for the substring "<html". This could turn out to be wrong sometimes. Eventually I would like to implement a pure text parser that avoids the DOM entirely. This is at conflict with the goal of using as much native functionality as possible because native functionality is extremely fast, and it guarantees the logic mirrors the browser's own input processing behavior.

## Note on malformed html output
This is currently completely naive with regard to the validity of the output html. You might end up truncating in the midst of a table cell, or a paragraph, or a pre, or pretty much any tag that typically expects a closing tag.

This concern is offset by how this focuses only on returning text, and not the html tags. But it is still a concern.

In fact it makes me want to rethink the approach eventually.


## old notes
* HTML truncate improvements

I do not like how I have to do a regex test at the end of the function, this is yet another pass over the input. I would prefer a single pass algorithm.
I do not like how using the native parser at all is basically an XSS issue. It feels like there is a better approach that avoids XSS issues.
Using let/const caused deopt warnings about "unsupported phi use of const" in Chrome 55. This may no longer be an issue and I would prefer to use a consistent declaration style.
Double check the behavior of setting nodeValue or reading nodeValue. Clearly understand how it encodes or decodes implicitly.
There is an issue with truncation when the input string contains entities because of the implicit decoding that occurs. The truncation position is inaccurate. This currently truncates the decoded position, which is different than the nearest legal position in the encoded raw input.
If tokenize_html is implemented, this should probably switch to that and avoid using native parsing. This avoids the lossy issue, and possibly avoids the inaccurate position issue.
Write tests

## todos
* finish up conversion of test to new test format
