# favicon
// TODO: the lib shouldn't know about database names and such, or at least,
// the app layer here should be the one specifying database name and version
// Basically the lib should not have defaults, and error out if options not set,
// and this should be setting params to calls to favicon_create_conn here always


// TODO: merge all app-tier favicon functionality here
// TODO: this should be the sole mediator of interactions with the
// favicon-service module, there should be no other direct interactions, this
// serves as a layer of indirection that makes the rest of the app resilient
// to changes
// TODO: need to redo the favicon-service lib, it was dumb to try and use a
// class, and it may be dumb to cram it all into one file
// TODO: should probably give up on the full lookup and just do origin lookups
// only, this is a library concern though
// TODO: use console everywhere

## lookup-icon
Lookup the favicon url for a url. Returns a promise that resolves to the url (string).

### Params
* url {URL} the location to investigate
* document {Document} the pre-fetched document, optional
* skip_fetch {Boolean} whether to attempt to fetch the full text of the resource, and if it is html, search for a url within the html, before continuing to check other places.

## favicon-refresh-feeds notes
TODOs:
* document
* test
* use cursor for scalability over N-feeds instead of getAll
* in fact, should probably use cursor.update, and should not even re-use `db_get_feeds` or some cursor walk helper, should directly interact with database without an intermediate layer
* this should be using a single transaction, not sure how to handle the issue with transaction timeout during lookup. Probably should be doing two passes. One preload all feeds, saves just the most basic information (feed id, link, urls), then lookup favicons in mem, then second pass iterates feed store and updates. If a new feed created in between the two txns it will be missed, that's fine. If a feed is deleted in between the two txns, it will never try to interact with the intermediate lookup table so that's fine. If a feed is mutated in between, not really sure what to do. Also: what if this is called concurrently? what if a second call starts while first is running?
