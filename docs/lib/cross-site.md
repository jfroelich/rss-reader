# cross-site
**SECURITY WARNING**: This module is unsafe. It uses various approximations that are not guaranteed to be correct. It should not be relied upon for anything security related.

The module principally exports the function `url_is_external`. The `url_is_external` function returns `true` when the `other_url` parameter is *external* to the `document_url` parameter.

A url is external when it comes from a different website. This could be because the origin is different. However, this may allow for ignoring differences in the subdomain, by only looking at the top domain. In other words, http://subdomain.domain.com and http://www.domain.com could be considered the same website, so, for example, a document from the domain that contains an embedded resource, such as an image, that comes from the subdomain, would still consider the image as internal.

Classifying a url as internal/external is useful for determining whether fetching an embedded resource (e.g. an image) would probably involve a network request to a different website. For example, a module that searches for and removes telemetry features may consider an element with an external url as an telemetry indicator.

### Notes and todos
* Think of a better name for `url_is_external`. Consider renaming it to `is_external_url`.
* Does origin include port? Maybe I should be doing port comparison at certain points in the logic
* If I ever get around to trying to make the is_geographical_domain test more accurate, a good resource is https://publicsuffix.org/list/public_suffix_list.dat
* If I want to handle urls more accurately, review punycode issues
* Consider making an ip address module for more accurate ip address handling
* Cite research
