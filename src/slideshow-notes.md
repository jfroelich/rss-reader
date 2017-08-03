TODO: Convert the contents of this file to markdown syntax

TODO: should poll channel really be distinct from db? Not so sure anymore.
Maybe I just want to use a general "extension" channel that handles all
extension related messages? Perhaps the only major qualifying characteristic
is the persistence of listening for messages for the lifetime of the page,
and organizing the logic according to the content of the response is done
with the conditions within the listener. There are different message
frequencies so some conditions are rarely true which means some wasted
checks, but on the other hand there are less channels. Would it be simpler,
and would the added simplicity outweight any performance benefit/cost, or
is there not even really much of a perf cost.

TODO: decouple loading of additional content with navigation. It causes
lag. Instead, create a queue of articles, and refill it periodically on
some type of schedule (using setInterval or a re-setTimeout-per-append)
Only append during navigation if the queue has not yet refilled.
TODO: if advancing to next article too quickly, some articles are loaded
that were already loaded, leading to duplicate articles. The call to append
articles needs to be delayed until scrolling completes or something like
that. Actually I think it is because the mark-read is on a diff 'thread'
than the update code. The append needs to wait for mark read to complete.

- figure out why markAsRead cannot just remove the read attribute, I would
prefer to remove it instead of set it to empty. for some reason if i remove it
this causes some type of bug.

- instead of using chrome message listener, i'd like to figure out the
post message api. it is cross platform and lower level and seems like an
interesting challenge.

- react to entryDeleteRequestedByUnsubscribe message sent from
Subscription.remove
- react to entry archive message sent from ArchiveService

- in appendSlides, think more about what to do on database connection failure

- the unsubscribe event was deprecated, why do i even have onUnsubscribe? it
is never called. maybe i should just remove it
- in onUnsubscribe, verify that I removing all listeners when removing the
slide, or have the removeSlide function do it
- in onUnsubscribe, stop using reduce. Just use a for..of loop
- in onUnsubscribe, I still need to implement how the UI updates if the slide
currently shown was removed.

- in maybeAppendSlides, can use querySelector to get the first slide itself
instead of getting the parent container and checking its children. we do not
actually need a count here, just a check of whether firstElementChild is
defined.

- regarding onSlideClick
TODO: just checking if image parent is in anchor is incorrect
The correct condition is if image is a descendant of an anchor, use
closest instead of parentNode
TODO: this should probably be the handler that determines
whether to open an anchor click in a new tab, instead of
setting a target attribute per anchor.
NOTE: event.target is what was clicked. event.currentTarget is where the
listener is attached.
TODO: define event.target using a variable. What does it mean. Does it
mean the dom object to which the listener is attached? Or does it
mean the element that was clicked on? etc.
TODO: bug, when clicking on an image in a link, it is still a link
click that should open the link in a new window...
TODO: this should be checking if in anchor axis, not
just immediate parent

- in appendSlide
TODO: use <article> instead of div
NOTE: in the current design, fetched content scrubbing is done onLoad
instead of onBeforeStore. This is not the best performance. This is done
primarily to simplify development. However, it also means we can defer
decisions about rendering, which provides a chance to customize the
rendering for already stored content and not just content fetched in the
future. It also emphasizes that scrubbing must be tuned to be fast enough
not to cause lag while blocking, because this is synchronous.
todo: rename title variable, use better variable names in this function
  TODO: use section instead of span for article content section

- regarding onKeyDown
//event.target is body
//event.currentTarget is window
Handle key presses. Although I would prefer the browser managed the scroll
response, there is a strange issue with scrolling down on an article moved
into view if I do not explicitly handle it here because it is an inner
element that does not I think have focus, so the down arrow otherwise has no
effect.
TODO: maybe I should always be clearing both keydown timers? I need to
test more when spamming left right
- is there a builtin enum of key code names that i could use instead of my
own custom list?

TODO: instead of binding onKeyDown to window, bind to each slide? That way
we don't have to use a global tracking variable like Slideshow.currentSlide,
which feels hackish.

- regarding scrollToY
TODO: i do not love the innards of this function, make this easier to read

- regarding filter article title
Attempts to filter publisher information from an article's title.
The input data generally looks like 'Article Title - Delimiter - Publisher'.
The basic approach involves looking for an end delimiter, and if one is
found, checking the approximate number of words following the delimiter,
and if the number is less than a given threshold, returning a new string
without the final delimiter or any of the words following it. This uses the
threshold condition to reduce the chance of confusing the title with the
the publisher in the case that there is an early delimiter, based on the
assumption that the title is usually longer than the pubisher, or rather,
that the publisher's name is generally short.
//
There are probably some great enhancements that could be done, such as not
truncating in the event the resulting title would be too short, as in, the
the resulting title would not contain enough words. We could also consider
comparing the number of words preceding the final delimiter to the number
of words trailing the final delimiter. I could also consider trying to
remove the publisher when it is present as a prefix, but this seems to be
less frequent.
