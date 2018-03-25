
### TODOs

* use single instance of favicon service
* do not construct favicon service locally, accept fs as param instead of conn
* document
* use cursor for scalability over N-feeds instead of getAll
* in fact, should probably use cursor.update, and should not even re-use get_feeds or some cursor walk helper, should directly interact with database without an intermediate layer
