`for-each-active-feed` asychronously queries the database for active feeds and then calls the `handle_feed` function argument on each feed.

The handler function is called *during* iteration over the feeds in the database as each feed is visited; not later.

`for-each-active-feed` completes when iteration over the feeds in the database completes. *Iteration may complete prior to all handlers completing*. In other words, iteration over the feeds can complete while one or more handler function calls are still in an incomplete/pending state.

### Params
* **conn** {IDBDatabase} an open database connection to the feed database
* **handle_feed** {Function} called for each active feed with the deserialized feed object as its sole argument, the function should be synchronous and pure (free of side effects, at least persistent state changing ones)

### Return value
Returns a promise. The return value of the promise itself is undefined, or at least, the return value of the promise should be ignored.

### TODOS
* Refactor get-feeds as for-each-feed, have for-each-feed accept a predicate parameter, then remove the implementation here and have it simply decorate a call to for-each-feed with a feed-is-active predicate
* Eventually, consider using an index on active to speed this up. I am not at the moment because I do not think there is much of a speed increase, and prefer not to use an index unless there is a material performance benefit
* consider a limit parameter that applies to number of active feeds evaluated
