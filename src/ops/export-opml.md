`export_opml` generates an opml document object consisting of all of the feeds in the database. The function is async.

### Errors
* Invalid inputs (e.g. title is not a string, connection is undefined)
* Database errors (e.g. database is unavailable)

### Todos
// TODO: implement for-each-feed operation, then use it here without buffering
// feeds into an array, instead write them to document per iteration
