The `rdr_update_feed` operation creates or updates a feed in the database.

Other than the situation where an options flag is true, this inserts the feed object *as-is*.

### Context params
* **conn** {IDBDatabase} required, an open database connection
* **channel** {BroadcastChannel} required, a channel to send messages about a feed being updated
* **console** {object} required, logging destination

### Params
* **feed** {object} the feed object to store, required
* **options** {object} optional, the set of options to specialize the call

### Options
* **validate** {Boolean} optional, if true then feed's properties are validated, and an error is thrown if the feed is invalid
* **sanitize** {Boolean}
* **set_date_updated** {Boolean} optional, if true then the feed's `dateUpdated` property is implicitly set to the time this function is called

### Errors
* **TypeError** feed is not a feed type
* **InvalidStateError** closed channel when calling postMessage
* **Error** validate is true and feed is invalid
* **DOMException** database interaction error

### TODOs
* when updating, is put result still the feed id? I know that result is feed id when adding, but what about updating? Review the documentation on IDBObjectStore.prototype.put, double check and warrant this resolves to an id
* attempting to update a feed with invalid properties where validation is done, should not result in an immediately-thrown exception, because failing validation is not a programmer error. This should instead result in a rejection of the returned promise, more similar to a database call error. The only error that should be immediately thrown that is related is when calling update on a value that is not a feed, because that is a programmer error.
* i am not sure this should even reject in the case of attempting to update a feed with invalid properties, rejections should only occur generally in the case of programmer errors or other less-ephemeral errors (e.g. no database or something), but using invalid data is obviously not a programmer error. However I don't know how to differentiate nicely in the exit conditions and return value of the function. What should happen when the feed has invalid properties if I do not throw?
* in the case of creation, we probably do not need to listen for request success
