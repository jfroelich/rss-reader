
# TODO: fix bug in create_article_title_element

this is double encoding entities somehow, so entities show up in the value

i partially fixed by not escaping ampersand but that's not right.

# TODO: improve slide_append

the creation of a slide element, and the appending of a slide element, should be two separate tasks. This will increase flexibility and maybe clarity. slide_append should accept a slide element, not an entry.



# TODO improve slide_onclick handler

Regarding the opening of a connection to mark as read. This belongs in a helper in ral.js. The problem however is that I split up the functionality, this uses the element, I cannot use the element in ral. So really the problem is that slide_mark_read does too much. This should be able to use only those components of slide_mark_read that it cares about. But in order to break up slide_mark_read appropriately, I think I need to refactor how the element is updated after click, I think it needs to be done from message event handler instead of explicitly done, so that it no longer matters which initiator started the sequence.

It really does not belong in ral.js. It belongs somewhere as a function, I am just not sure where.

#TODO: improve on_key_down

* is the debouncing stuff with idle callback approach needed??
* do not handle key press if target is input/textarea
* where is it bound? should be named something like window_onkeydown to be consistent with other handler names

# TODO: slide_next notes

I should probably unlink loading on demand and navigation, because this causes lag. navigation would be smoother if I appended even earlier, like before even reaching the situation of its the last slide and there are no more so append. It would be better if I did something like check the number of remaining unread slides, and if that is less than some number, append more. And it would be better if I did that before even navigating. However that would cause lag. So it would be even better if I started in a separate microtask an append operation and then continued in the current task. Or, the check should happen not on append, but after doing the navigation. Or after marking the slide as read.

Sharing the connection between mark as read and slide_load_and_append_multiple made sense at first but I do not like the large try/catch block. Also I think the two can be unlinked because they do not have to co-occur. Also I don't like how it has to wait for read to complete.

Like the notes in the click handler, this should be calling to a helper in ral.js that deals with conn open and close

# TODO: uploader_input_onchange notes

* show operation started immediately, before doing any time-consuming work
* after import, visually inform the user that the operation completed successfully
* after import, refresh feed list so that it displays any new feeds, if feed list is visible
* after import, switch to feed list section or at least show a message about how the import completed successfully, and perhaps other details such as the number of subscriptions added
* on import error, show a friendly error message

# TODO: window_onclick notes

* am I still using marginLeft? I thought I switched to left?

# TODO: export_menu_option_handle_click notes

* visual feedback on completion
* show an error message on error

# TODO: refresh_anchor_onclick notes

* this is a click handler, nothing happens after it since it is already forked, this could be async and not use ugly promise syntax
* show a completed message on refresh complete?
* show an error message on refresh error?

# TODO: feeds_container_append_feed notes

* create helper function feed_element_create that then is passed to this, rename this to feed_element_append and change its parameter
* at end, this needs to find the proper place to append the feed using feed_compare. This needs to iterate over the existing feeds and compare each one to the feed and find where to insert, and fall back to append. I no longer am pre-sorting an array and then iterating over it, I am using a callback that loads feeds from the db in natural order.

# TODO: slideshow_page_init notes

* if loading initial feed list fails with an error, then show a friendly error message?
* because the loading function itself is called non-awaited, and because the slow part occurs at the very end, this function could be async and use await syntax rather than promise, which I prefer because the promise syntax is ugly.
