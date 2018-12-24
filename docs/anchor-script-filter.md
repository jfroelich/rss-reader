Unwraps anchor elements containing href attribute values that are javascript
If document is undefined or otherwise not a document this throws an error.
Returns undefined. This unwraps rather than removes to avoid data loss.
Unwrapping the element achieves the desired result of disabling the
javascript. Generally any anchor that is a script anchor serves no other
purpose than providing a click handler.

Also note that this does not deal with onclick attributes or anything of that
sort. This is restricted to analyzing the href attribute. Onclick and friends
are a concern for another filter.

This is not concerned with ripple effects of removing content, such as
the result of adjacent text nodes, the visible decrease in whitespace
delimiting displayed content, etc. Some of this concern is addressed by
how unwrap is implemented, but there can be other side effects.


## TODOs

TODO: is there a way to write a css selector that imposes a minimum length
requirement on an attribute value? This would helpfully reduce the number
of anchors matched and move more processing to native. Using a minimum
length check would not run into the same problems that a starts-with style
check encounters (which is why this does not use starts-with).

TODO: if the selector guarantees the attribute is present, then is the href
attribute value guaranteed defined? Such as for <a href>foo</a>? If so,
then there is no need for the href boolean condition here. It will be
implicit in the length test.
