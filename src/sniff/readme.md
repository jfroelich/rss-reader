
sniff.js provides basic functionality for guessing whether the url of a resource indicates the resource is binary or non-binary.

The `url_is_binary` function returns whether the url represents a binary resource. Note that the return value of false means either text or unknown; false does not mean only text.

Note the text_protocols array is not exhaustive.


* TODO: if text/plain is the default for data uri that does not specify a mime type, that indicates non-binary. Why call `mime_type_is_binary`? Why not just return false if `find_mime_type_in_data_url` returns undefined? The logic remains the same but involves one less function call in one of the two paths.
* TODO: move all the misc todo comments and ideas and such either to readme.md or as individual github issues, then simplify all the superfluous commentary
* TODO: the call to url_get_extension should be implicit in `find_mime_type_for_extension`
* TODO: When unable to get an extension, we cannot confidently say it is binary so report it is not. I do not like how this implies that it is not-binary. This potentially induces a false reliance. Perhaps url_is_binary should return true, false, and indeterminate, and let the caller decide how to react. Same issue if fail to find mime type for extension.
* TODO: in find_mime_type_in_data_url, review the use of href. This captures the href and cache. The href getter is dynamic and a function, similar to how array.length is a function. I do not trust that that the URL implementation is smart enough to cache property access, at least for now. This admittedly may be premature optimization, but I am overlooking that as I remain ambivalent about its importance. What I am concerned about is whether this is actually slower.

### Notes on string_is_alphanumeric

The function returns whether the string is alphanumeric. Counter-intuitively, this works by testing for the presence of any non-alphanumeric character. The empty string is true, null/undefined are true. Does NOT support languages other than English

* See https://stackoverflow.com/questions/4434076
* See https://stackoverflow.com/questions/336210

### Notes on mime_type_is_binary

This algorithm assumes that mime types with the 'application' supertype are binary unless the subtype is one of the following. The following list is not exhaustive, but it covers most of the cases this app is interested in, which is about fetching xml files.

### Notes on `EXTENSION_TYPE_MAP`

A mapping of common file extensions to corresponding mime types. I've tried to pick standardized mime types but unfortunately there does not appear to be much of a standard.
