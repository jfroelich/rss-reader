The `contains_feed` function checks for whether the query matches a feed in the database. Returns a promise that resolves to a boolean value indicating whether a feed exists in the database.

How a feed is uniquely identified may change in the future. This is problematic for code that checks for existence because it is hard-coded to a particular approach. The purpose of this operation is to abstract away the logic, such as whether it is based on a matching id, or because of a url, or a hash of some kind.

### Params
* **conn** {IDBDatabase} an open database connection
* **query** {object} the query object, should contain a URL property

### Errors
* {TypeError} if query object is malformed, url is not a url
* {DOMException} if there is a database error

### Internal notes
Because we are querying for existence, and not the full feed details, use the key-only flag to avoid full deserialization
