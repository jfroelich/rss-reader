
# Feed background updating

Checks for new content

# TODO: rename poll feed context properties to use underscore convention

Left over from prior style, did not change. Did not change because it is more complicated because several callers in several places directly set props.

# TODO: poll service should not manage channel lifetime (or database lifetime)

Consider moving all lifetime management to caller. The opening of the channel in the init helper is the source of an object leak in slideshow context, where this channel is created then replaced and left open. It has no listener, but it is still heavyweight and and well, just incorrect.

Basically, the init helper shouldn't exist. This all has to be done by the caller, because the caller manages the lifetime.

Similar issues with the close helper. Always closing channel is impedance mismatch with persistent channels used by calling contexts, rendering callers unable to easily call this function. Consider removing the close call here, or moving all channel lifetime management concerns to caller. This was the source of a bug in polling from slideshow, where polling closed the slideshow's persistent channel when it should not have.


# TODO: poll service should somehow not depend on badge

This should not be dependent on something in the view, it should be the other way around

# TODO: consider changing feed_poll to accept feed_id instead of feed object

To enforce that the feed parameter is a feed object loaded from the database, it is possible that poll_service_feed_poll would be better implemented if it instead accepted a feedId as a parameter rather than an in-mem feed. That would guarantee the feed it works with is more trusted regarding the locally loaded issue.

# note from detected_modification

TODO: rename dateLastModified to lastModifiedDate to be more consistent in field names. I just got bit by this inconsistency.

# poll_service_feed_poll note todo

Does coerce_feed throw anymore? I don't think it does actually, so I should not be using try/catch?

# handle_poll_feed_error notes

New kind of problem, in hindsight, is merging of count of errors for parsing and fetching. suppose a feed file which is periodically updated becomes not-well-formed, causing parsing error. This is going to on the poll period update the error count. This means that after a couple polls, the feed quickly becomes inactive. That would be desired for the fetch error count, maybe, but not for the parse error count. Because eventually the feed file will get updated again and probably become well formed again. I've actually witnessed this. So the issue is this prematurely deactivates feeds that happen to have a parsing error that is actually ephemeral (temporary) and not permanent.

Rather than try and update the database, perhaps it would be better to simply generate an event with feed id and some basic error information, and let some error handler handle the event at a later time. This removes all concern over encountering a closed database or closed channel at the time of the call to rdb_feed_put, and maintains the non-blocking characteristic.

# poll_entry notes and todo

Despite checks for whether the url exists, we can still get uniqueness constraint errors when putting an entry in the store (from url index of entry store). This should not be fatal to polling, so trap and log the error and return.

I think I need to look into this more. This may be a consequence of not using a single shared transaction. Because I am pretty sure that if I am doing rdb_contains_entry_with_url lookups, that I shouldn't run into this error here? It could be the new way I am doing url rewriting. Perhaps I need to do contains checks on the intermediate urls of an entry's url list as well. Which would lead to more contains lookups, so maybe also look into batching those somehow.

# entry_reader_db_exists note

This only inspects the tail, not all urls. It is possible due to some poorly implemented logic that one of the other urls in the entry's url list exists in the db At the moment I am more included to allow the indexedDB put request that happens later to fail due to a constraint error. This function is more of an attempt at reducing processing than maintaining data integrity.

# entry_update_favicon note

Favicon lookup failure is not fatal to polling an entry. Rather than require the caller to handle the error, handle the error locally.

If the favicon lookup only fails in event of a critical error, such as a programming error or database error, then it actually should be fatal, and this shouldn't use try/catch. However, I've forgotten all the specific cases of when the lookup throws. If it throws in case of failed fetch for example that is not a critical error. For now I am leaving in the try/catch. But, I should consider removing it.

# entry_update_content todo

The min contrast ratio should be loaded from local storage once, not per call here. I don't care if it changes from call to call, use the initial value
