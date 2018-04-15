The `rdr_update_feed` operation creates or updates a feed in the database.

Other than the situation where the set_date_updated flag is true, this inserts the feed object *as-is*. It is the caller's responsibility to take care of any sanitization needs.

### Params

* conn {IDBDatabase} an open database connection
* channel {BroadcastChannel} optional, a channel to send messages about a feed being updated
* feed {object} the feed object to store
* validate {Boolean} optional, if true then feed's properties are validated, and an error is thrown if the feed is invalid
* set_date_updated {Boolean} optional, if true then the feed's `dateUpdated` property is implicitly set to the time this function is called

### Exceptions

* If conn is not defined, open
* If channel is not a channel
* If feed is not a feed object
* If validate is true and the feed has invalid properties
* If some error occurs when interacting with the database

### TODOs

* when updating, is put result still the feed id? I know that result is feed id when adding, but what about updating? Review the documentation on IDBObjectStore.prototype.put, double check and warrant this resolves to an id
