
MIME utility functions

`parse_content_type` parses a mime type string from an HTTP response header value for the `Content-Type` header.

The current implementation is relaxed regarding input to increase caller convenience. The function does not throw in the case the input is not a string. Technically I usually consider passing invalid input to a function as a programming error. However, here I've made an exception to the rule because in the typical case the header value coming from an http response cannot be trusted as well-formed. All that being strict accomplishes is to make it more annoying for the caller and creates a need for more boilerplate wrapper code. In other words, I am saying that input validation in this case is the callee's responsibility.

`is_mime_type` returns whether the given string represents a valid mime type. The check is relatively lax (aka loose, not-strict). The goal of this function is to provide a floor, a minimum validity guarantee that the value at least appears to be a mime type, even if the value does not correspond to a real mime type. In other words, I want to treat most inputs as valid, and only reject when I am pretty sure the input is invalid.

# TODO: increase the accuracy of min/max constants

The current values are rather arbitrary. They provide some bounds to allow for early exits during parsing and to quickly check validity based on length. Eventually I would like these values to have a sounder basis. Currently the values are just based on an arm's length view of the typical mime values I've personally observed using shoddy empirical evidence.

# TODO: make `is_mime_type` more strict

* Do not allow `foo/bar/baz`
* There should only be one slash allowed.

# TODO: document and record that law I came across about tolerating sloppy input but producing nice output and cite as a design philosophy
