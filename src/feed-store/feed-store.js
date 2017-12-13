/*
Implementation notes:

The basic idea is that I want reader-db and all its sub modules to use an object oriented api.
One reason is I like how favicon cache is implemented.
Two is because pretty much every function uses connection. Using an OO api would avoid the need
to pass around the connection as a paramter to every method.
Three is because it seams reasonable to be stateful. A cache instance is opened or closed.
Four is because I think dependency injection is still supportable. I just did not have a clear
picture of how it could work last time I tried.
Fifth is because I am less resistant to OO, I think I went a tad overboard with embracing c style,
and last time I attempted this I believe I discarded it because I wanted to use pure functions
and no objects.
Sixth is because I now have a better understanding that entry and feed objects are model objects
and not independent objects. They are closely tied to the model. They just represent a storage
format.

Note that as part of transition there will be some minor functionality changes. One being that
the isOpen stuff should belong here, instead of calling out to IndexedDbUtils directly. This
shields the caller from indexedDB a bit more, or in other words is more of a concrete abstraction.

Rather than rewrite the functionality in place, I am going to do it in phases:

1. Write the skeletal class.
2. Make basically wrapper functionality around reader-db calls in this class.
3. Update callers to use this class in place of directly accessing reader-db modules.
4. Inline all the wrapped functionality from reader-db and delete reader-db

Note, phases overlap. I am going function call by function call. Storing with opening and closing

*/

import * as IndexedDbUtils from "/src/indexeddb/utils.js";
import openDb from "/src/reader-db/open.js";

export default function FeedStore() {
  /* IDBDatabase */ this.conn = null;
}

FeedStore.prototype.open = async function() {
  this.conn = await openDb();
};

FeedStore.prototype.isOpen = function() {
  return IndexedDbUtils.isOpen(this.conn);
};

FeedStore.prototype.close = function() {
  IndexedDbUtils.close(this.conn);
};
