
# About

I love the movie Spaceballs.

This removes ping attributes, adds no referrer, removes some tracking images

Telemetry images are usually hidden, so treat visibility as an indicator. False
positives are probably not too harmful. Removing images based on visibility
overlaps with sanitization, but this is intentionally naive.

Further reading:

* https://blog.fastmail.com/2016/06/20/everything-you-could-ever-want-to-know-and-more-about-controlling-the-referer-header/
* http://w3c.github.io/html/links.html#link-type-noreferrer

# Notes on getElementsByTagName vs querySelectorAll

When iterating over anchor elements, this uses getElementsByTagName
instead of querySelectorAll. getElementsByTagName is faster when there is not an
issue with removal while iterating.

# Notes on why is_hidden_element checks for presence style attribute

The attr check possibly short circuits the implicit style calculations
that happen when invoking the implicit getter img_element.style. I have not
tested this recently, just an assumption.

# TODO

* Write tests
* It should be possible to detect cross-origin or cross-domain requests and
possibly treat those differently. This requires knowledge of the url of the
document which is currently not available.
* deal with the new picture element
* The offscreen detection has poor accuracy, probably need to test width + left, instead of just left.
* Look into regex bulk matching. Maybe use a builder strategy that composes a
single matcher, use the RegExp constructor instead of the regex literal to build
a single string delimited by pipes. This may be a premature optimization. See
https://www.reddit.com/r/programming/comments/3c3vl0
