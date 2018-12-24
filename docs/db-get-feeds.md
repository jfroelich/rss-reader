get_feeds todos
* consider using title sort key in database instead of sorting in memory


* for getFeeds consider using a title-sort-key field and an index on this property
instead of sorting in memory, kind of wonky because it requires a database upgrade
and changes to how options page shows feeds
