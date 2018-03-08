The `url_is_external` function returns `true` if the `other_url` is *external* to the `document_url`.

This function is inaccurate as well as insecure. It should not be used for security purposes.

This function is useful to determine if fetching an embedded resource (e.g. the url of an image in a web page) would probably involve a cross origin url.

Here, cross-origin is used loosely. This does not operate on the actual origin. This operates on an approximation of a url's domain by looking only at the upper levels of a domain. This is useful, for example, when determining whether a telemetry image is embedded in an html document, because concerning telemetry images almost always come from a different domain.

# geo suffix

https://publicsuffix.org/list/public_suffix_list.dat


# TODO

* review punycode support
* does origin include port? Maybe I should be doing port comparison
* rename to something like cross-site or site-bounds, this is more accurate given that this does not operate on origin, maybe use a real-property legal metaphor
