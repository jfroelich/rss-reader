`write-feed-property` asynchronously updates the property of a corresponding feed object in the database. When the database is updated, a `feed-updated` type message is sent to the channel with the feed-id and information about the state-change.

Internally, this fetches the feed object corresponding to the id, modifies the property of the feed object, and then saves it back to the database. This is done using a single transaction to guarantee data integrity. The corresponding message is not posted until the transaction resolves successfully, to avoid any premature reaction by listeners in the event of a database error. However, in the event that posting a message to the channel encounters an error, note that the database state was still permanently changed, despite the error. A typical reason for a channel error is an InvalidStateError that is thrown when calling postMessage on a closed broadcast channel. Because this is async and because the postMessage call occurs in a later event loop epoch, the channel should not be closed until after this call has resolved. In other words this call should be awaited if the channel will be closed. Given that it is almost always correct to close the channel, because channels should not be long-lived, this call should almost always be awaited.

With regard to the feed-updated property, it is implicitly and automatically set to the run date of the call as a side effect, unless the feed-updated property itself is the specified property to update.

The function balks with an error when attempting to set a feed's `id` property. This function should be used in attempt to change a feed's id, because technically this makes no sense.

### Context params
* **conn** {IDBDatabase} an open database connection
* **channel** {BroadcastChannel} the channel to receive a message about the state change
* **console** {object} the logging destination

All context parameters are required

### Params
* **feed_id** {Number} the id of the feed to modify
* **name** {String} the name of the property to modify
* **value** {any} the new value of the property
* **extra_props** {object} a map of additional related key-value pairs to consult when setting the property, such as for use in setting implicitly dependent properties as a part of the same operation

### Errors
* **DOMException** - if something goes wrong interacting with the database
* **TypeError** - if feed_id is not a well-formed id, if the property name is invalid
* **Error** - if context not an object or has invalid props
* **InvalidStateError** - if channel is closed when posting message

### Return value
Returns a promise that resolves to undefined. The promise settles either when an error occurs or when the transaction completes and the channel messages have been posted.

### Internal notes on validation

// The current level of property validation is relatively weak, given that
// it should never occur and we are the sole users of this api call. Therefore
// name validation is minimal. Hereinafter, assume the name is canonical.
// TODO: consider a stronger check, possibly using some kind of a schema of
// known properties

// Always refuse calls that try to update id. The id property cannot be
// updated, because it is the keypath to the object. Changing the id is
// nonsensical here because changing the id effectively means inserting a new
// object or overwriting some other object, or a pointless noop in the case of
// updating itself. Because it is so nonsensical it is elevated to programmer
// error level treatment worthy of a thrown error.

// NOTE: in the previous approach of using specialized calls like
// activate-feed and deactivate-feed, there was no need for this check. This
// is an example of the drawback of using a more generic (less-specialized)
// approach. I did not even initially consider this drawback when deciding
// to move forward on implemenation. There is the possibility I
// over-generalized and want to reconsider something more granular (more
// specific to the problem) that is in between set-any-property and
// set-particular-property. Some kind of middle ground like
// set-writable-properties or something, where I qualify the subset of
// properties amenable to this approach.

### TODOs
* after implementation, I realized an issue with the contents of the messages sent to the channel, such as for when activating or deactivating a feed, in that if I only send out the property name, the message handler does not have enough information from reading the message to discern whether a feed became active or inactive, and can only tell that active-state changed. I am not sure if it is needed yet, but I think I need the handler to be able to discern the direction of the state change.
* TODO: maybe validation is wasteful or paranoid?
* is_valid_type_for_property: maybe this should somehow borrow from some external defined-once-in-one-place (singleton?) schema definition that has per-property settings of type and allows-null(empty). I could also do a check above for whether the property exists in the schema in that case
* is_valid_type_for_property: not currently exhaustive, may use switch statement


// TODO: maybe define a helper like is_valid_property_name that encapsulates
// both these checks (the name checks). They are tied together so they kind of belong to the
// same abstraction, right? Tentative.


// TODO: tests
// TODO: create readme, move comments to readme or github
// TODO: in the readme explain the rationale behind the function's name because
// it is relatively unique and breaks from the naming convenition used thus far.
// moreover, consider revising names of other operations in the ops folder to
// use the read/write naming convention.

// TODO: think more about the error-like-but-not-really cases. Perhaps I am
// using the wrong abstraction. Perhaps this should be doing something like
// returning a value to distinguish between a successful update, a failed
// update, and a thrown error. There are really three cases but right now the
// caller can only know about two. I could also reconsider using a status code
// to represent categories of the outcome. I could do a mix of status and
// exception, where I throw errors in the programmer case, but never throw in
// the other cases. So maybe I was partially right earlier when pursuing a
// status-return-oriented design, and wrong to fully rollback to exceptions.
// Perhaps I want a compromise in the middle. However, the problem with that it
// is unconventional, I mean who does this. Perhaps I need to treat all error
// cases as actual errors, and throw even in the non-programmer-error cases,
// because basically Javascript forces code to work that way. Perhaps I could
// qualify that conclusion as less-awful because that is an acceptable
// characteristic of interpreted languages. Or maybe I should review go syntax.
// I just really dislike the current implementation because just logging is
// awkward.

// TODO: review the debate on whether to define a helper function for input
// variable validation.
// TODO: review the debate on whether to use an assert helper
// TODO: review the use of function.name as a parameter to log messages
// TODO: consider renaming feed_id_is_valid to is_valid_feed_id, I have
// inconsistent naming patterns and I think this may be one

// TODO: if I do deprecate functions like activate-feed, maybe I want to
// additionally export pre-defined helper functions from this module, right
// here, that abstract away the boilerplate. One issue with that, is that
// currently the way I have setup the ops folder, it is one export per module. I
// would be breaking that convention. However I do kind of want to move in that
// direction. I don't know, mixed feelings. Another drawback is that the set of
// helpers exported would not be exhaustive, which might be counter-intuitive
// and give the appearance of an incomplete API, or lead to an unexpected
// result, a surprise, when one goes to use a helper just like the others and
// finds it does not exist.

* Why check state sanity when updating active props? does it really matter? are these error worthy or is it correct to use log messages? Maybe I should allow the caller to make such mistakes.
* Is it strange or counter-intuitive that I have a write-feed-property without a corresponding read-feed-property function? At the moment there is no use case for reading a single property that I readily see. In addition, it is basically impossible to read a single property unless I use the index load-key-only trick.
* What if I have a predicate parameter, like `mutator-function`, that allows the caller to specify the transition of properties that should occur, instead of localizing the logic for each of the property changes within the write function itself. This distributes the logic into each of the calling contexts. Maybe that makes more sense, albeit more complicated? This would leave the write function to just care about writing, which I kind of like as it feels like sep-concerns.
* What if I grouped the 3 props for active in the schema. So change the feed schema to have a sub-object, active-props, with 3 properties: active, reason, date. Then I could things like `feed.active_props.date = new Date()`, `if(feed.active_props.active)`...
