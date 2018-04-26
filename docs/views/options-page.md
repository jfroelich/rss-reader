# options-page
**Intend to deprecate**. I plan to deprecate the options page and move to a single page app. However there is quite a lot of code to shift over to the slideshow page. Also, I want to focus on a better UI. I grew sick of the options page. For one, Google keeps changing how it works. Google changed the style of the options page too. Two, I like the idea of experimenting with a single page application (SPA). This is partly in preparation for toying with react or other view libraries. Three, it turns out it is pretty annoying to change display settings.

# TODO: stop importing page-style settings
I plan to have options page no longer provide configurable display settings

# TODO: submonitor
* instead of removing and re-adding, reset and reuse
* when showing the submonitor why not just rely on element_fade's ability to handle the situation
of an element without an explicit opacity? My instinct is that this was a leftover setting from back when I was developing element_fade and was running into the unexpected situation of an element that did not have an opacity set, but I know that I've since rectified element_fade to handle that case, so I do not think this is needed. In fact I am relying on that behavior in several other places so this is rather inconsistent. Inconsistency is bad

# TODO: section_show
* if cannot find element to show, then what? while this is certainly indicative of a serious error, serious errors shouldn't happen at UI level, so something else should happen here?

# TODO: feed_list_append_feed
* maybe stop using custom feed attribute? it is used on unsubscribe event to find the LI again, but is there an alternative?
* if html_truncate throws the error should be handled and suppressed

# TODO: feed_list_item_onclick
* if feed not found in db then show an error message
* show num entries, num unread/read
* show dateLastModified, datePublished, dateCreated, dateUpdated

# TODO: subscribe_form_onsubmit
* if failed to parse input as url, then show an error message
