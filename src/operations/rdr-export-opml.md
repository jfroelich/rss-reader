`rdr_export_opml` creates an opml document object as a blob. The function is async.

### Thrown errors

* Invalid inputs (e.g. title is not a string, connection is undefined)
* Database errors (e.g. database is unavailable)

### TODOs

* maybe should just export document instead of blob. exporting to blob seems overly-specified, or overly-restricted. asking the caller to do the conversion does not place a lot of burden on the caller, and greatly increases flexibility of the output
