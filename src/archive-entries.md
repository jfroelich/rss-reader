`Archiver.prototype.archive` transforms certain entries in the reader database. The transform involves a reduction in size. Entries that are older than a given time period are affected.

Entries need to stick around for the following reasons:
* To keep track of which urls have been visited, so that previously read articles are not re-downloaded and re-presented in the view.
* To keep track of stats (e.g. num articles read) because currently stats are setup to be recalcuated from scratch, and are not stored in aggregate.

However, we do not need to keep around the full set of properties for an entry. For example, because the entry is no longer viewable, we do not need its content. Therefore it makes sense to occasionally scan the database for older, already-read entries and reduce their size.

### getAll vs cursor

While getAll is substantially faster, it does not scale. archive runs as a background task so it is not performance sensitive, but it is still somewhat data-size sensitive. If the number of articles grows very large, using getAll would require loading an absurd amount of data into memory, when in fact that memory does not need to live for very long. So, while using the cursor is slower and involves a ton of stack calls, it scales better. With the cursor, only a limited number of entry objects ever reside in memory at any one point in time.
