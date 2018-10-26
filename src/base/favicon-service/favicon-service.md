# favicon-service.js

## TODOS
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
