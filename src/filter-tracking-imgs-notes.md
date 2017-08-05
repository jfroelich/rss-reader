
# TODO

* write tests
* the host list should probably be a parameter
* instead of strings for hosts, should maybe accept a set of regexes, or somehow
accept a combined set of regexes that is merged into a single regex for speed, or
accept strings that are converted into a single regex, or something like this

# Brainstorming about integration with dnt_html_document

The concern about integrating is that this must happen prior to trying to set
image dimensions.

This is because set_img_dimensions potentially pings the image, which would
defeat the whole point of avoiding the ping by using this function.
Looking at poll_entry, right now it does call this prior.
But if I merge, then it would happen after image dimensions are set. That is
the problem.  If order of call is so important then it is a shared concern,
so maybe a better solution is a general library that processes a documents
images generally, and ensures correct order is used.

In other words the various image processing operations are not fully
associative.

One idea is to merge, and then ensure that tracking data is removed prior to
anything else. I should probably rename dnt-html-document to remove-tracking-data
or something to that effect, fold this into that, and also ensure it is called
earlier in poll_entry, before images are fetched

# Events that should be handled better

* &lt;img src="https://ad.linksynergy.com/asdf"&gt;
* &lt;img height="1" width="1" style="display:none" src="https://www.facebook.com/asdf"&gt;
* &lt;img src="http://metrics.foxnews.com/asdf" style="display:none;" width="0" height="0"&gt;
* &lt;img src="http://www.foxnews.com/...pixel..." style="visibility: hidden; position: absolute; left: -999px; top: -999px;"&gt;
* &lt;img src="http://secure-us.imrworldwide.com/adsf" style="display:none;" width="0" height="0"&gt;
* &lt;img alt="Image" src="https://3.bp.blogspot.com/asdf" srcset="url 72w, url 144w"&gt;
* &lt;img itemprop="image" data-baseurl="url"  srcset="url 350w, url 400w" sizes="(min-width: 1260px) 750px, (min-width: 1060px) calc(100vw - 559px), (min-width: 840px) calc(100vw - 419px), (min-width: 800px) 800px, 100.1vw"&gt;
* &lt;img src="http://static.advance.net/static/common/img/ad_choices_arrow_transparent.png" width="9" height="10"&gt; (tracking image)
* &lt;<img style="position: absolute" src="https://anon-stats.eff.org/js/?..." width="0" height="0" alt=""&gt;
* &lt;img src="http://bat.bing.com/action/0?ti=5281114&amp;Ver=2" height="0" width="0" style="display:none; visibility: hidden;"&gt;

# TODO

If an image has explicitly set attribuets width and height and both are set
to exactly "0", then this is probably a tracking image that should be removed.

# copied notes from github issue

Copied from source:

&lt;img height="1" width="1" alt="" style="display:none" src="https://www.facebook.com/tr?id=619966238105738&amp;ev=PixelInitialized"&gt;

Side note, this was revealed as non-html, I think from noscript:

&lt;img src="http://dbg52463.moatads.com/?a=033f43a2ddba4ba592b52109d2ccf5ed" style="display:none;"&gt;

&lt;img src="http://d5i9o0tpq9sa1.cloudfront.net/?a=033f43a2ddba4ba592b52109d2ccf5ed" style="display:none;"&gt;
