
# About truncate_html

Truncates a string containing some html, taking special care not to truncate in
the midst of a tag or an html entity. The transformation is lossy as some
entities are not re-encoded (e.g. &#32;).

The input string should be encoded, meaning that it should contain character
entity codes.

The extension string should be decoded, meaning that it should not contain
character entries.

# NOTES

* currently using var due to deopt warning "unsupported phi use of const"
present in Chrome 55
* Accessing node.nodeValue implicitly decodes the text. The resulting string
will not contain entities. Similarly, setting node.nodeValue will implicitly
encode.

# TODO

* use tokenize_html once implemented, this will avoid the entity decoding issue
* test whether deopt warning still occurs, and if not, revert to using let/const
* test again the assertion about node.nodeValue
