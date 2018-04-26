# export-opml
Generates an opml document object consisting of all of the feeds in the database. Async.

### Params

### Errors
* Invalid inputs (e.g. title is not a string, connection is undefined)
* Database errors (e.g. database is unavailable)

### Todos
* finish docs
* write tests
* implement for-each-feed operation, then use it here without buffering feeds into an array, instead write them per iteration
