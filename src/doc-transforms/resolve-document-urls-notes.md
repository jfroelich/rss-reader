
# Misc. improvements to resolving document urls

* Should probably be rewritten to only inspect relevant attributes per element type, instead of a general map?
* use a more qualified or clearer function name for resolveElement, this resolves the value for a particular url-containing attribute of the element
* not entirely sure why i have this see also comment, i think it was help in defining the attribute map
-- See also https://github.com/kangax/html-minifier/blob/gh-pages/src/htmlminifier.js

Regarding resolving doc urls

* think of what do about the common 'http://#fragment' url value found on various sites
the removal of http://# probably belongs in a separate filter pass or should not be done, or it should at least be unwrapping instead of removing possibly valuable content
* think about what to do about the common '#' url. Usually these are just links back to the top, or have an onclick handler. maybe these should be treated specially by a separate transform.
* resolve xlink type simple (on any attribute) in xml docs

# TODO: Support style images when resolving document urls

style.backgroundImage

check if image has inline style, and if so, inspect the style property, and if it has a background or background image property, and that property has a url, then ensure the url is absolute.

what about the fact that style is removed from all attributes when scrubbing the dom. This makes this operation seem pointless.

I could revise the attribute filtering part to allow for style background image. But then I need to think more about how that can affect a rendered article

# TODO: support background images (copied from old github issue )

For example:

&lt;img src="url" osrc="url" style="background: url(url); background-position: 0px -5422px;width:270px;height:87px"&gt;
