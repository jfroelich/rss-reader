# contains-feed
Returns a promise that resolves to a boolean value indicating whether a feed exists in the database. How a feed is uniquely identified may change in the future. This is problematic for code that checks for existence because it is hard-coded to a particular approach. The purpose of `contains_feed` is to abstract away how feeds are compared for equality when testing for existence.

### Params
* **conn** {IDBDatabase} an open database connection
* **query** {object} the query object, should contain a URL property

### Errors
* {TypeError} if query object is malformed, url is not a url
* {DOMException} if there is a database error

### Internal notes
Because we are querying for existence, and not the full feed details, use the key-only flag to avoid full deserialization
