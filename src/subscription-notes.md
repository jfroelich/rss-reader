# Unsubscribe todos

* Rather than request badge update, maybe it would be better if badge update
responded to a broadcasted message about the change in entry store state. Like
an entries-changed event.
* Look into a deleteAll type function. Then I could delete all entries by
feed id, without loading the entry ids into memory.
* Do I really need to broadcast a message per entry delete, or is just
broadcasting a single message saying that one or more entries were deleted is
sufficient? For that matter, at what level of abstraction? Maybe just
broadcasting a feed delete message implies the rest. Or more abstractly, just
broadcast an unsubscribe event, that implies that feed and entries deleted. The
more abstract message seems more appropriate because this unsub function
operates at a more abstract level than the db because it has other concerns
outside of manipulating storage, and because it is intended to be idiomatic.
This isn't meant to be a part of the db layer that is merely a basic db
modification, it is meant to be above it, as an intermediary, a proxy for
talking to the db. It is an app-level event instead of a db specific one. I
suppose one concern then is what other areas of the app need awareness of
individual entry deletes? Take a look at slideshow. What if one of the slides
loaded into the ui is an entry that was just deleted. What should happen?
Without knowledge of the specific entry id, how would slideshow know how to
react? Should it even react? It is even important if it is out of sync? Sure
the mark as read operation fails. But maybe that can be re-imagined as a
tolerable error.
