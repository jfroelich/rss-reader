# activate_feed
Given a feed id, updates the corresponding feed in the database and marks it as active. If the feed was inactive and has properties related to being in the inactive state, those properties are removed. The dateUpdated is also updated to the current date.

## Params
**session** an open connection to the database, required

**feed_id** the id of the feed to modify, required

## Return value
Returns undefined.

## Errors
**Error** if the session parameter is undefined

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
