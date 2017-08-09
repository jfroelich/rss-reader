
# About

Removes ping attributes, adds no referrer, removes some tracking images

# TODO

* write tests
* instead of strings for hosts, should maybe accept a set of regexes, or somehow
accept a combined set of regexes that is merged into a single regex for speed, or
accept strings that are converted into a single regex, or something like this
* review where ping attribute is used, not sure if on anchors or what
* Because it is difficult to identify individual images, and it is also
difficult to just use 1x1, look for any images that are very skinny either
vertically or horizontally. Like images posing as horizontal rules or
vertical borders/content delimiters. Admittedly this has a style-filtering
quality to it, so maybe this should only be looking at 1x1s/0x0s
* It should be possible to detect cross-origin or cross-domain requests and
possibly treat those differently. This requires knowledge of the url of the
document which is currently not available.
* return total number of elements modified or removed?
* maybe the image filters should be moved to do it all in one pass

# NOTES

* https://blog.fastmail.com/2016/06/20/everything-you-could-ever-want-to-know-and-
* more-about-controlling-the-referer-header/
* http://w3c.github.io/html/links.html#link-type-noreferrer

# TODO: improve the offscreen detection

Probably need to test width + left, instead of just left.
