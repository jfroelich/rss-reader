# Overview

The cross-site module principally exports the function `url_is_external`. The `url_is_external` function returns `true` if the `other_url` parameter is *external* to the `document_url` parameter. This function is useful to determine if fetching an embedded resource (e.g. the url of an image in a web page) would probably involve a network request to a different website.

This function is **unsafe**. It uses various approximations that are not guaranteed to be correct.


# geo suffix

https://publicsuffix.org/list/public_suffix_list.dat

# TODO

* review punycode support
* does origin include port? Maybe I should be doing port comparison
