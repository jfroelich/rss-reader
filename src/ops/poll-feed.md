Checks for updates to a particular feed.

### TODO: consider changing `poll_feed` to accept feed_id instead of feed object

To enforce that the feed parameter is a feed object loaded from the database, it is possible that poll_service_feed_poll would be better implemented if it instead accepted a feedId as a parameter rather than an in-mem feed. That would guarantee the feed it works with is more trusted regarding the locally loaded issue.

### note from detected_modification

TODO: rename dateLastModified to lastModifiedDate to be more consistent in field names. I just got bit by this inconsistency.

### handle_error todo

New kind of problem, in hindsight, is merging of count of errors for parsing and fetching. suppose a feed file which is periodically updated becomes not-well-formed, causing parsing error. This is going to on the poll period update the error count. This means that after a couple polls, the feed quickly becomes inactive. That would be desired for the fetch error count, maybe, but not for the parse error count. Because eventually the feed file will get updated again and probably become well formed again. I've actually witnessed this. So the issue is this prematurely deactivates feeds that happen to have a parsing error that is actually ephemeral (temporary) and not permanent.

Rather than try and update the database, perhaps it would be better to simply generate an event with feed id and some basic error information, and let some error handler handle the event at a later time. This removes all concern over encountering a closed database or closed channel at the time of the call to `update_feed`, and maintains the non-blocking characteristic.
