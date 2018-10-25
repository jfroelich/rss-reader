# favicon
Provides functionality for finding the favicon corresponding to a given url, and for caching lookups to speed up future lookups and reduce network load.

## Public functions
* **lookup** specify the url of a page and find the url of its favicon
* **clear** remove all entries from the favicon cache
* **compact** remove expired entries from the favicon cache
* **open** open a connection to the favicon cache


## Design notes and todos
* i think i want to break up the functionality into smaller modules. one, i do not love how i export all these disparate tests in a single test module for the cache. two, now this approach of aggregated functionality in a single module is a little bit inconsistent with the approach used in other places. three, i like how easy it is to document individual modules instead of monoliths. on the other hand, i end up with many modules (even though all but one are pseudo-private), i spread out functionality into multiple modules that maybe should not be spread out (the distributed monolith anti-pattern), i've already done some of the work (ok that is a bad reason but still true)
* document
* implement lookup tests
* rename folder to favicon, no need for -service suffix
* think more about how to solve the concurrent github requests problem
* consider caching favicon as data uri within db
* look into imposing image dimensions constraints, need to get image dimensions somehow but from the raw bytes of response
* if HTTP HEAD yields 405 maybe i want to retry as GET?
* maybe record the favicon's mime type in the entry data
* maybe there should be a higher level compact operation that looks at all entries in the favicon store that do not correspond to a cached article, and remove them, basically remove orphaned favicons
* if I do store bytes, maybe i want to be more careful about duplicates, e.g. two sites that use the same favicon should each reference favicon entry by id, and entries should just be a table of favicons with ids, and then there is separate table of site-to-favicon-id mappings
* if i switch to storing and using bytes, i should no longer be rejecting unacceptable mime types, or at least i should be less strict, because if we are grabbing the bytes then we can do deep sniffing and do not care about the mime type. this will avoid issues with dishonest/errant http responses.
* lookup should not trust the url found in document, need to actually ping the image
* lookup finding favicon in root should consider the expires header reported by the response from the server? also if it is in the past it should just store it as never-expires. this means i need to allow never-expires by having expires property not defined
* the default expires date should be configurable via params to lookup, the delta from current date should not be hardcoded, the delta should just default to a default value if not specified
* test that creating a second entry in cache with same url does not create second and just overwrites first
