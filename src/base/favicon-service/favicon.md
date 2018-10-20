This is undergoing redesign. Here are the notes

* design new favicon cache
* design new favicon service
* cache will be used only by favicon service, the service will re-export any functionality that needs to be called by a higher layer
* cache will store expiration date as part of entry, instead of passing max-age parameter to compact
* probably just rename to favicon, no need for -service suffix
* the new lookup should be decoupled from fetch modules in higher layer for now
* database name should come from a parameter, not be hardcoded in the library. instead the library should just use a default name, and allow the caller to override it. the higher layer favicon.js controller module can choose to hardcode the app's preferred name and then pass it as a parameter
* ensure not to use config.js from higher layer, everything should come from parameters to the functions, this should be independent of the app, config.js can instead only be used from the higher layer favicon.js controller module (basically to load config values and then appropriately pass those values as parameters to here)
* field names in db will be in snake_case
* i will create favicon-cache2, and favicon-service2 first, then switch the higher layer favicon controller module to use it, then remove the old files, then remove the 2 suffix
* the new lookup function should accept one parameter, a lookup_request or lookup_query style object
* no FaviconService object, just export functions from the module, the db connection can be first class
* cache entries will be PER ORIGIN, not per page url
* drop the suffix "string" from field names in the db
* use an index on entry url (which again is now origin url string) to speed up lookup, unless url is the object store key path in which case that is self-defeating
* decouple from fetch utils located in higher layers for now. i still need coupling at some point because of the need to block http requests per origin for certain origins (like github.com which denies concurrent request), but i will factor that in later, not now
* it is ok to couple to other libraries in this layer, so it is ok to retain coupling to indexeddb.js, because that is just too much duplication otherwise, so this will not be a completely standalone module
* consider caching the bytes of the icon in the store, i think this functionality can come in a later revision. this will enable offline mode, increase privacy
* eventually write actual documentation but only for the public part of the api
* eventually write tests, do tests for cache and service separately
* i think this should not depend on html.js, maybe just parse_html, so i think i also need to eventually de-aggregate html.js module, and realize it was a mistake to aggregate there
