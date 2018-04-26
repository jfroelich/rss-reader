# find-feed-by-url
Search the database for a feed with the given url. The primary use case for this function is to check if a feed exists in the database with the given url. In that case the `key_only` parameter should be set to true.

### Params
* **conn** {IDBDatabase} an open database connection
* **url** {URL} the url to query
* **key_only** {Boolean} if true then the returned feed only contains the hidden feed magic property and the matched feed id.

### Errors

### Return value

### Notes

### Todos
* improve docs
* write tests
