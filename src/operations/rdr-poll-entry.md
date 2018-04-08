
# poll_entry notes and todo

Despite checks for whether the url exists, we can still get uniqueness constraint errors when putting an entry in the store (from url index of entry store). This should not be fatal to polling, so trap and log the error and return.

I think I need to look into this more. This may be a consequence of not using a single shared transaction. Because I am pretty sure that if I am doing contains_entry_with_url lookups, that I shouldn't run into this error here? It could be the new way I am doing url rewriting. Perhaps I need to do contains checks on the intermediate urls of an entry's url list as well. Which would lead to more contains lookups, so maybe also look into batching those somehow.

### entry_exists note

This only inspects the tail, not all urls. It is possible due to some poorly implemented logic that one of the other urls in the entry's url list exists in the db At the moment I am more included to allow the indexedDB put request that happens later to fail due to a constraint error. This function is more of an attempt at reducing processing than maintaining data integrity.

### entry_update_favicon note

Favicon lookup failure is not fatal to polling an entry. Rather than require the caller to handle the error, handle the error locally.

If the favicon lookup only fails in event of a critical error, such as a programming error or database error, then it actually should be fatal, and this shouldn't use try/catch. However, I've forgotten all the specific cases of when the lookup throws. If it throws in case of failed fetch for example that is not a critical error. For now I am leaving in the try/catch. But, I should consider removing it.

### entry_update_content todo

The min contrast ratio should be loaded from local storage once, not per call here. I don't care if it changes from call to call, use the initial value
