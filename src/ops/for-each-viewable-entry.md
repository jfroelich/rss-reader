The `viewable_entries_for_each` function opens a cursor over the entry store for viewable entries starting from the given offset, and iterates up to the given limit, sequentially passing each deserialized entry to the callback. Returns a promise that resolves once all appropriate entries have been iterated. The promise rejects if an error occurs in indexedDB.

### Parameters
* **conn** {IDBDatabase}
* **offset** {Number}
* **limit** {Number}
* **callback** {Function}

### TODOs
* create a `request_onsuccess` helper
* do I want a separate callback for on-all-iterated?
