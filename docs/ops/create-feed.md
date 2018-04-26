# create-feed
Creates a new feed in storage.

### Params
* **sanitize** {Boolean} if true then the feed is sanitized prior to storage

### TODOS
* document
* unit test
* consider not delegating to `write_feed`
* consider deprecation, have the caller just call write-feed and let write-feed decide how to react, would mean less code, fewer operations, this does not do much more than write-feed does anyway.
