**SECURITY WARNING**: This module is unsafe. It uses various approximations that are not guaranteed to be correct.

The cross-site module principally exports the function `url_is_external`. The `url_is_external` function returns `true` if the `other_url` parameter is *external* to the `document_url` parameter.

This is useful to determine if fetching an embedded resource (e.g. the url of an image in a web page) would probably involve a network request to a different website. For example, a module that examines telemetry features in a web page may consider an element with a URL characterized as external as evidence of telemetry, because externality is most often an indicator.

### Notes and todos

* I remain dissatisfied with the exported function name. It does not seem to fit well or provide the right metaphor or tell the right story or something.
* Does origin include port? Maybe I should be doing port comparison at certain points in the logic
* If I ever get around to trying to make the is_geographical_domain test more accurate, a good resource is https://publicsuffix.org/list/public_suffix_list.dat
* If I want to handle urls more accurately, review punycode issues
* Consider making an ip address module for more accurate ip address handling
* Cite any research I did, I think I failed to keep much of it around it unfortunately, because this was before I decided to try and document stuff
