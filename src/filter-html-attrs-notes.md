
# TODO

* should be optionally parameterizable somehow, like accept the map of allowed
attributes as a parameter, and default to the current map

* note it is not this responsibility to remove empty attributes, that is a
concern for condense_html_document, this is only a security pass/sanity pass,
make embeddable pass

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

One idea is related to the issue of how sanitizing is doing things in addition
to sanitizing. The core concern is basically that I want to do things like
strip style information because I want to make the document *embeddable*. All
these other libraries are sort of skirting around the edges of the issue. The
most direct and clear reason is so that the document can be embedded. This is
distinct from compression, from sanitizing bad html, from removing tracking
data, etc. It is purely for embedding purposes. So what I really want is a
make-document-embeddable transformation. Then this filtering of attributes with
its cross-cutting concerns makes more sense.
