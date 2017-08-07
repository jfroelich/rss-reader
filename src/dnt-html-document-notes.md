
# About

Removes ping attributes, adds no referrer, removes some tracking images

# TODO

* review where ping attribute is used, not sure if on anchors or what
* Because it is difficult to identify individual images, and it is also
difficult to just use 1x1, look for any images that are very skinny either
vertically or horizontally. Like images posing as horizontal rules or
vertical borders/content delimiters. Admittedly this has a style-filtering
quality to it, so maybe this should only be looking at 1x1s/2x2s
This assumes image size is set, as in this should be called after
set_img_dimensions. The problem is by that point, the ping happens. So this
kind of needs to happen before.
* Another idea is to track cross domain requests. This requires knowledge of
the document's own request url in order to compare it against the src url
of each image. This would also make it easier to filter tracking images.
Maybe that functionality should be merged with this
* Should this be accessing image size using getAttribute instead of property?
* This should have been caught either here or in filter tracking
&lt;img height="1" width="1" src="http://insight.adsrvr.org/track/evnt/..."&gt;

* If this adds no referrer then filter attributes processing needs to retain
that element, otherwise it is truly stupid and pointless


# NOTES

* https://blog.fastmail.com/2016/06/20/everything-you-could-ever-want-to-know-and-more-about-controlling-the-referer-header/
* http://w3c.github.io/html/links.html#link-type-noreferrer
