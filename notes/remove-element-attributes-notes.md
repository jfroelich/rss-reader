
# TODO

* Write tests

# Why this currently stands alone from other transformations

Basically I split up DOM scrubbing into separately concerned functions
such as secure_html_document, sanitize_html_document,
and condense_document. When splitting up that function I could not decide
where to place this functionality. The issue is that this function has multiple
concerns:

* It plays a minimization role by removing attributes
* It plays a sanitization role by removing style information, ids, etc
* It plays a security role by removing script handlers, unknown attributes

Because it of the multiple concerns I cannot simply fold it into any one of
these other functions. Unsure how to best approach it.

I cannot have certain functions only remove certain attributes. There is an
XSS concern due to the possible presence of custom attributes. This is why
a blacklist approach does not work. I have to use a whitelist approach, and
remove all non-whitelisted attributes.

One idea is related to the issue of how sanitizing is doing things in addition
to sanitizing. The core concern is basically that I want to do things like
strip style information because I want to make the document *embeddable*. All
these other libraries are sort of skirting around the edges of the issue. The
most direct and clear reason is so that the document can be embedded. This is
distinct from compression, from sanitizing bad html, from removing tracking
data, etc. It is purely for embedding purposes. So what I really want is a
make-document-embeddable transformation. Then this filtering of attributes with
its cross-cutting concerns makes more sense.

It is not this responsibility to remove empty attributes, that is a
concern for condense_document, this is only a security pass/sanity pass,
make embeddable pass

# Notes on getElementsByTagName

This uses getElementsByTagName over querySelectorAll internally because I
assume that getElementsByTagName is faster and therefore preferable when there
will not be any elements removed during iteration.

# Notes on getAttributeNames

Element.prototype.getAttributeNames was added in Chrome 61.

* https://developer.mozilla.org/en-US/docs/Web/API/Element/getAttributeNames
* https://blog.chromium.org/2017/08/chrome-61-beta-javascript-modules.html

From the docs: Element.getAttributeNames returns the attribute names of the
element as an Array of strings. If the element has no attributes it returns
an empty array. Using getAttributeNames along with Element.getAttribute, is a
memory efficient and performant alternative to accessing Element.attributes.

The return value is a new array of strings, so there is no need to walk backward
due to the issue with removing items from a live list while iterating that list.
