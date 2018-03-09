Resource acquisition layer (RAL). An intermediate layer between storage and the view that helps calls acquire and release needed resources, and supplies some default values. The goal is to generally boil down calls from the view to simple function calls against a simple api, and abstract away the need to open and close databases and setup other values. The functions in this layer implicitly connect to databases using the app's default settings. Therefore these functions are not easily testable, and the calls that have been wrapped should be tested instead, because those calls accept an open database connection as input, which allows for using a mock database.

TODO: for ral_find_feed_by_id, open the conn here, remove the auto-conn ability from
reader_db_find_feed_by_id

TODO: originally I had a title index in the database, and loaded the feeds
in sorted order. That caused a big problem, because indexedDB does not
index missing values, so the result excluded untitled feeds. So now I sort
in memory after load. However, I'd still like to think about how to do this
more quickly. One idea is that I store a sort-key property per feed in the
feed store. I guarantee the property always has a value when storing a
feed. Each time the feed is updated, and when the feed is created, the
property is derived from title, and it also normalizes the title (e.g.
toLowerCase). Then I can create an index on that property, and let
indexedDB do the sorting implicitly, and quickly, and more efficiently.
At the moment, this isn't urgent.
A second component of the the decision is that it would support a for_each
approach. Right now I am forced to fully buffer all feeds into an array
first in order to sort. If a let the db do the work I could use a callback
as each feed is loaded.

TODO: make a closer helper that does log-and-close
