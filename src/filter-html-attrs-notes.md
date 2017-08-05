
# TODO

* needs cleanup, add helper functions
* should be optionally parameterizable somehow, like accept the map of allowed
attributes as a parameter, and default to the current map
* should have a verbose parameter

# Why this function currently stands alone from other html document transformations

Basically I split up scrubby.js into separately concerned functions
such as secure_html_document, sanitize_html_document,
and condense_html_document. When splitting up that function I could not decide
where to place this functionality. The issue is that this function has multiple
concerns:

* It plays a minimization role by removing attributes
* It plays a sanitization role by removing style information, ids, etc
* It plays a security role by removing script handlers, unknown attributes

Because it of the multiple concerns I cannot simply fold it into any one of
these other functions. Unsure how to best approach it.

I cannot have certain functions only remove certain attributes. There is an
XSS concern due to the possible presence of unknown attributes. This is why
a blacklist approach does not work. I have to use a whitelist approach, and
remove all unrecognized/non-whitelisted attributes.
