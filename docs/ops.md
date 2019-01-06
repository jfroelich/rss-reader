# export-opml
Creates and triggers the download of an OPML document containing feeds from the database

## TODOs
* implement tests

# import-opml

## A note about the File object
A `File` implements the `Blob` interface. This is not well documented for some reason and is surprisingly confusing.

## TODOs
* break apart into two layers, a UI layer and a lower controller layer. The controller layer should work without a UI and it is what should be tested
* test multiple files
* test multiple feeds per file
* test dup handling

# refresh-feed-icons
Update the favicon for each of the active feeds in the database


# subscribe (module)
Provides functionality for subscribing to a feed, or unsubscribing from a feed

## subscribe (function)
Subscribe to a feed.  Entries are excluded because it takes too long to
process them on initial subscribe.

## subscribe params
@param session {DbSession} an open DbSession instance
@param iconn {IDBDatabase} an open icon database connection
@param url {URL} the url to subscribe
@param should_notify {Boolean} whether to send a notification
@param fetch_timeout {Number} fetch timeout
@error database errors, type errors, fetch errors, etc
@return {Promise} resolves to the feed object stored in the database


## TODOs
TODO: in hindsight, notifications do not belong here. whether someone wants
to be notified depends entirely on context. in import-opml, there is no
desire to notify per subscription, but there is a desire to notify at the end
of the import. In the single subscribe use case, there is maybe a desire to
subscribe, in fact there probably is, and whether or not a notification
should appear is a concern of user preferences (enabling/disabling
notifications), something the caller will basically find out on their own and
pass in. Those are the two primary use cases I can think of, and I think it
would just be better to subscribe from within those contexts. Because the
parameter is an example of conditionally following a chain of extra
execution, and that is pretty much the boolean parameter anti-pattern,
because it is better to have more caller boilerplate and specify logic by
either calling the notification followup, or not calling it. If anything, I
can create a helper function like 'subscribe_get_notification_data' that
generates the data that the caller would want to use to do the notification.
Then the caller is making the decision by either calling the function or not
calling it, and is not deciding by setting the parameter. Another benefit is
the increased decoupling here.
