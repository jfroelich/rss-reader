
# activate_feed
Given a feed id, updates the corresponding feed in the database and marks it as active. If the feed was inactive and has properties related to being in the inactive state, those properties are removed. The dateUpdated is also updated to the current date.

**DOMException** some kind of database error, such as a table not existing, or a closed database connection.
**InvalidStateError** when the input channel is provided but is closing or closed when messages are posted (after the database transaction settles).
**TypeError** if the feed id is not well formed
**NotFoundError** if this could not find a feed with the given id in the database
**InvalidStateError** if the matched database object is not actually a feed
**InvalidStateError** if the feed is already in the active state

## Notes
* This involves first reading the feed into memory then modifying it and then writing it back to the database. If you already have a feed in memory, just use `update_feed` directly (in overwrite mode), for better performance.
* This should not be understood as the sole way to activate the feed. This is just a convenience helper for one of the typical use cases of `update_feed`.
* If a channel error occurs, the database may still have been updated. The only way to trigger the error is to try and send a message, which is not done until after the transaction completes.
* I believe this is safe for concurrency but have not tested

## Todos
* deprecate? this only adds trivial value over update_feed. on the other hand, there is some value in its consistency and remembering to also remove the inactive props.
* should activating an already active feed just be a noop instead of an error?
* should channel be a required parameter?
* if channel remains optional, should this use the stub pattern where a default noop channel is used, instead of checking if channel is defined?

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
