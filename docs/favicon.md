# favicon
**IMPORTANT**: this module is under development. Continue to use favicon-service and do not use this module.

Provides functionality for finding the favicon corresponding to a given url, and for caching lookups to speed up future lookups and reduce network load. Not spec compliant (does not always check document first, uses host-wide favicon regardless of page icon sometimes).

## Public functions
* **lookup** specify the url of a page and find the url of its favicon
* **clear** remove all entries from the favicon cache
* **compact** remove expired entries from the favicon cache
* **open** open a connection to the favicon cache

## Design notes
* for once, remember to not start using this until after the test is implemented, to practice discipline of testing

## Design notes and todos
* the default expires date should be configurable via params to lookup, the delta from current date should not be hardcoded, the delta should just default to a default value if not specified
* i think i want to break up the functionality into smaller modules. one, i do not love how i export all these disparate tests in a single test module for the cache. two, now this approach of aggregated functionality in a single module is a little bit inconsistent with the approach used in other places. three, i like how easy it is to document individual modules instead of monoliths. on the other hand, i end up with many modules (even though all but one are pseudo-private), i spread out functionality into multiple modules that maybe should not be spread out (the distributed monolith anti-pattern), i've already done some of the work (ok that is a bad reason but still true)
* document
* implement lookup tests
* think more about how to solve the concurrent github requests problem
* consider caching favicon as data uri within db
* look into imposing image dimensions constraints, need to get image dimensions somehow but from the raw bytes of response, note i am referring to width and height here not image byte size
* if HTTP HEAD yields 405 maybe i want to retry fallback as GET?
* maybe record the favicon's mime type in the entry data
* maybe there should be a higher level compact operation that looks at all entries in the favicon store that do not correspond to a cached article, and remove them, basically remove orphaned favicons, but note this would be some control-layer module and not a concern of this module, so move this todo somewhere else
* if I do store bytes, maybe i want to be more careful about duplicates, e.g. two sites that use the same favicon should each reference favicon entry by id, and entries should just be a table of favicons with ids, and then there is separate table of site-to-favicon-id mappings
* if i switch to storing and using bytes, i should no longer be rejecting unacceptable mime types, or at least i should be less strict, because if we are grabbing the bytes then we can do deep sniffing and do not care about the mime type. this will avoid issues with dishonest/errant http responses.
* i wonder if i get bytes and create blob, if blob.type is initialized (e.g. file.type) and that is a fast, secure, smart way to do sniffing
* lookup should not trust the url found in document, need to actually ping the image
* lookup finding favicon in root should consider the expires header reported by the response from the server? also if it is in the past it should just store it as never-expires. this means i need to allow never-expires by having expires property not defined
* move over relevant todos and bugs and notes from favicon-service before deleting it when refactoring to use this

# favicon-cache
# cache.js
This module provides persistence for favicon.js. This should be considered private to favicon.js and its test module. Do not directly import. favicon.js re-exports any of the functions that are needed.

## todos
* test that creating a second entry in cache with same url does not create second and just overwrites first

# favicon-control
This is a higher layer wrapper module around the base favicon-service module. All other functionality that need favicon functionality in this extension should operate through this wrapper, and should not directly interact with favicon-service. This way I only need to change one module if the favicon functionality changes.

# favicon-service
# favicon-service.js
Functionality for looking up the url of the favicon image for a page url, along with caching requests for later reuse.

## TODOS
* fetch_html dependency is a layer dependency violation (at the moment)
* lib modules should not depend on app modules
* Break up the favicon lookup function into smaller functions so it easier to read
* bug with oracle.com lookup, the lookup fails because the response content type is literally "unknown". However, the browser allows it. I suppose this is because the browser inspects the bytes or something.
* the url parameter should be separate from options
* the document parameter should be separate from options
* rather than max age approach, cached entries should specify their own lifetimes, and each new entry should get a default lifetime, and lookup caller should be able to provide a custom lifetime for any new entries
* regarding the use of Object.assign at the start of the lookup implementation, review Object.assign. I believe it is shallow but I've forgotten. Right now document is a property and I do not want to be cloning it, just copying the reference to it.
* When sending a HEAD request for an image, instead of throwing network errors, consider returning a fake Response object with the appropriate HTTP status error code and only throwing in the case of a programming error
* Write tests for favicon service, Create a test library that fully tests this, and what I should really do is write stubs for fetch and such and then create a ton of tests that test every branch
* Use a better approach to concurrent favicon lookups to the same origin. A feed frequently contains several entries pointing to articles on the same site. When polling visits each entry, it looks up the entries favicon. This leads to several lookups to the same origin. I want to implement something that is opaque to polling, because I do not want polling to be concerned with it, so somewhere above or below the abstraction level of the favicon lookup function. This thing should somehow recognize that several requests are being made to the same origin. If a request is currently in-flight, then the new request should join that existing request as a waiter for its result instead of starting a new request. If a request was recently completed, then a new lookup should recognize the request was recently performed and should use its result instead of performing a new request. If an existing request does not exist, then a new request should be registered so that other lookups that are to the same origin find it. This is something like a queue. But I am not quite sure of the details, and am a bit fearful of the complexity.
* Do not keep favicon lookup failure entries around forever, The failure guards should eventually let the request succeed somehow. Probably failure entries should also have an expiration period. But based on expires date set in entry instead of externally, so that I can have different expiration dates for non-failure cache items and failure cache items. The compact function could also check for these and remove expired

* note on fetch-image, now that this is in the lib, decide on whether to
reintroduce some kind of policy hook. Perhaps the easiest way would be to add a
parameter to fetch_image and then forward it?


// ### Test todos:
// * actually run tests instead of command line
// * test offline
// * test a non-existent host
// * test a known host with origin /favicon.ico
// * test a known host with <link> favicon
// * test a non-expired cached input url
// * test a non-expired cached redirect url
// * test a non-expired cached origin url
// * same as above 3 but expired
// * test against icon with byte size out of bounds
// * test cacheless versus caching?
// * test compact
// * reintroduce dependency on html-parser


* Refactor how entry expiration is calculated in favicon cache. Store 'expiresDate' property in entry at time of creation/update instead of dateUpdated
property. Keep in mind servers respond sometimes with an expires header. This seems better and probably more in line with other systems, the db would be more like other cache implementations this way, i am not making up my own custom expires date and instead trying to use whatever the remote server suggests, so it is more respectful


* Optimize favicon compact to use a single delete request. Check if indexedDB now supports a range for delete, and see if there is a simple way of deleting expired entries that does not involve object deserialization. I think Joshua Bell mentioned something on the github project about new indexedDB features, so this may eventually be supported.

* Do not fetch the full document body during favicon lookup. Use the new streaming api when sending a request to get a doc. Use together
with TextDecoder. Stream until <head is found. Then cancel the response. Then
recreate a full html string (append ></html>), then parse that for link
tags. This avoids the need to download the whole document. I do not think accuracy
decreases too much (e.g. fake in a js comment or something is rare). Maybe I can avoid parsing and just search raw text for link tags, the accuracy
loss may be ok given the speed boost. Research notes on streaming fetch responses:
https://jsbin.com/vuqasa/edit?js,console
https://jakearchibald.com/2016/streams-ftw/
https://jsbin.com/gameboy/edit?js,console whatwg/fetch#447

* Reduce favicon cache size. Caching by page url could lead to a huge cache. Maybe I should only be caching origins or domains or hostnames and never cache individual pages. think this should depart from the spec. Or maybe make it an option on whether to be compliant, or even have two functions one that is compliant and one that is not. The proposed algorithm: The lookup function should take an optional document object that contains the html of the lookup url. If the document is provided, search it. If found icon, store in cache and return icon. If the document has not been fetched, do not fetch it. Get the origin of the url.  Check if the origin is cached and if so return that. If the origin is not cached, lookup the root icon. If a root icon is found, store an entry linking the origin url to the root icon url, then return the icon url. If a root icon is not found, return null. This would avoid the need to perform a fetch of the document in many cases. For example, when there are several urls per origin, which is quite often given that a website's feed generally points to articles from that website. But also in the case of meta feeds like Google news, it points to articles from the same site several times. I am concerned right now that the double request isn't respecting the cache, even though I would assume the requests are coalesced. This is something to also look into. The net result would be less network overhead per lookup, and a significantly reduced cache size. There would be some inaccuracy when a single page's custom favicon differs from the origin's favicon, but I think for the purposes of this app that is fine. The generality of the favicon module should favor its purpose in this app over being accurate and spec compliant across all projects. Side note: I could just only cache origin urls, and consider all per-page urls as one-offs. I just need to make sure to do the origin-cache lookup after fetching the page, which I think is how it is done now.

* Research native favicon support in Chrome and other browsers. Revisit whether favicons are now supported from within a chrome extension. At least document very clearly why this library has to be used in the alternative. It may no longer need to exist. This time around, take better notes as to why I can or cannot use chrome internals.
* Deprecate favicon-service.js in favor of chrome's favicon services, This issue might be redundant with another issue, did not check. Not certain but I might be able to use chrome://favicons service in an extension? It seems to require a permission? It looks like this is not reliable? only works for pages in history? For now I have rolled my own. It seems like Google does not want extensions to use the service. Then again there seems to be a changing api and now it is supported? Do not have enough clear info. Then again, I generally want to avoid deep browser reliance? Or should I just give up on that.
