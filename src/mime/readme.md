# About

A mime-type value is a specialized form of a string. Therefore, there is no explicit data type, just helpers that work with strings that purport to be mime types.

* `parse_content_type` extracts the mime type of an HTTP `Content-Type` header.
* `is_mime_type` returns whether a string represents a mime type.

### parse_content_type notes

Rather than throw when input is invalid, this simply returns undefined, for convenience.

### is_mime_type notes

This is inaccurate. This only provides a loose guarantee that a string looks like a mime type.

# TODO: increase the accuracy of min/max constants

The current values are rather arbitrary. They provide some bounds to allow for early exits during parsing and to quickly check validity based on length. Eventually I would like these values to have a sounder basis. Currently the values are just based on an arm's length view of the typical mime values I've personally observed using shoddy empirical evidence.

# TODO: make `is_mime_type` more strict

* Do not allow `foo/bar/baz`
* There should only be one slash allowed.

# TODO: document and record that law I came across about tolerating sloppy input but producing nice output and cite as a design philosophy
