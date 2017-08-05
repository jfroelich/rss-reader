
# About

The problem this library tries to solve is to provide a simple means of getting
the url of the favicon associated with a given page url. At the time of writing
this library there was no simple browser-oriented-js solution available, and
Chrome appeared to be restricting access to its internal favicon cache.

The primary public function is `favicon_lookup`. lookup accepts a page url and
returns a favicon url. The function tries to conform to the spec, which sadly is
not extremely well documented, and has some inefficiency. Ignoring the cache
lookups, the algorithm involves the following steps:

1. Fetch the URL.
2. Search the contents of the URL for a <link> specifying the icon.
3. If no icon is found, check for '/favicon.ico' in the document root.

The spec talks about how to choose the most appropriate icon when multiple icons
are specified, based on size and other properties. I chose not to bother with
choosing the best, just finding any of them.

The lookup algorithm always checks the URL first, before checking for the
favicon.ico file in the domain's root path, because my understanding of
favicons is that individual pages of a website are allowed to specify an icon
that is unique to the page, and not site wide. Icons in the root are site
wide. Most sites in fact use the site wide icon. But because each page can be
different, I must always check the page, and this cannot be avoided.

In addition to lookup, there are two other key functions, connect and compact.

* `favicon_open_db` opens a connection to indexedDB. The connection
is the first parameter to the lookup function. indexedDB is used to provide a
simple caching mechanism for the lookup, that memoizes certain lookups.
* `favicon_compact_db` function is a housekeeping function intended to run
periodically. It examines the cache for older entries and removes them.

# Why this uses a separate database from the app

This uses a separate database in order to remain independent of the app. The
benefit of independence outweighs the cost of having to maintain separate
connections.

There may be an issue with some platforms not allowing for multiple, concurrent
connections. I think on iOS. But I am not too concerned.

# About "Refused to load the script" errors

Occasionally I see the following messages appear in the console: Refused to
load the script 'url' because it violates the following Content Security Policy
directive: "script-src 'self'". The code internally calls fetch. fetch
internally uses the Content Security Policy defined in the extension's
manifest. This app's manifest provides: "content_security_policy":
"... script-src 'self' ...". In the response headers I see the following:
link:<path-to-script>; rel=preload; as=script.  The reason that the warning
appears is because the script is pushed. To avoid this error I have to figure
out how to signal that I have no interest at all in HTTP/2. For push help see
section 3.3. of https://w3c.github.io/preload/, and also https://tools.ietf.org/html/rfc5988#section-5.

I do not currently know how to signal no interest in push. For now I must deal
with wasted resources and strange console messages. I asked stackoverflow: https://stackoverflow.com/questions/45352300

Side note on disabling OPTIONS: https://stackoverflow.com/questions/29954037
- maybe my setting of Accept is causing an issue?

# General todo items

* Spend more time thinking about the similarity of findLookupURLInCache,
findRedirectInCache, and findOriginInCache. The similarity really suggests
I should be using a single function.
* Implement findUnexpiredEntry, then look at where I call findEntry and
replace it
* Revisit whether favicons are now supported from within a chrome
extension. At least document very clearly why this library has to be used
in the alternative. It may no longer need to exist. This time around, take
better notes as to why I can or cannot use chrome internals.
* when checking image mime type, consider being more restrictive about allowed
content type: image/vnd.microsoft.icon, image/png, image/x-icon,
image/webp
* Should findIconInDocument use querySelectorAll?
* For compact, check if indexedDB now supports a range for delete, and see if
there is a simple way of deleting expired entries that does not involve
object deserialization.
* Look into why I see this log message repeatedly: Fetch finished loading: HEAD "https://github.com/favicon.ico". I should not be seeing this so frequently if
lookups are cached. I am not sure what is going on. It should be present in the
cache and not expired which means the initial cache lookup near the start of
the lookup function should find it, which means no fetching should occur at
all. Well, it is happening for specific pages on github, which then default to
the origin, but it seems like either the origin url is then not properly
searched for in the cache, or is not properly added to the cache, or is somehow
being inadvertently removed from the cache. Side note I may have resolved the
error after recent changes.
* Look for more opportunities for concurrency. Cache lookups can happen
concurrently with fetches?
* Spend some more time thinking about abstraction. I think I want to do more
to abstract away the use of indexedDB. Like, maybe favicon_lookup should accept
dbName/dbVersion params, and a dbConn param, and if dbConn not set, then
connect on demand, or something to this effect. That conflicts with logic of
cacheless lookup at the moment. There are my own use cases, one where i do not
reuse the open conn across calls and one where i do. but if this library were
ever used in other contexts, maybe there is no need for it. Also, maybe it is
worth using an option like FaviconCache that abstracts away indexedDB itself.
Not because I want to allow for swapping in other cache mechanisms. But because
I don't want the caller to be concerned with how indexedDB works. But maybe
this is over abstraction, and exposing indexedDB is a good thing?
* Validate icons found from links in a similar manner to how the origin root
icon is validated (using head, size, etc)
* what if i stored 'expiresDate' property in entry instead of dateUpdated
property? Keep in mind servers respond sometimes with an expires header. This
seems better and probably more in line with other systems, the db would be
more like other cache implementations this way, i am not making up my own
custom expires date and instead trying to use whatever the remote server
suggests, so it is more respectful

# TODO: Better document fetching

Use the new streaming api when sending a request to get a doc. Use together
with TextDecoder. Stream until &lt;head is found. Then cancel the response. Then
recreate a full html string (append >&lt;/html&gt;), then parse that for link
tags.

This avoids the need to download the whole document. I do not think accuracy
decreases too much (e.g. fake </head> in a js comment or something is rare).

Maybe I can avoid parsing and just search raw text for link tags, the accuracy
loss may be ok given the speed boost

Research notes on streaming fetch responses:
* https://jsbin.com/vuqasa/edit?js,console
* https://jakearchibald.com/2016/streams-ftw/
* https://jsbin.com/gameboy/edit?js,console
* https://github.com/whatwg/fetch/issues/447

# TODO: Reduce favicon cache size

Caching by page url could lead to a huge cache. Maybe I should only be caching origins or domains or hostnames and never cache individual pages.

think this should depart from the spec. Or maybe make it an option on whether to be compliant, or even have two functions one that is compliant and one that is not.

The proposed algorithm:

The lookup function should take an optional document object that contains the html of the lookup url
If the document is provided, search it. If found icon, store in cache and return icon.
If the document has not been fetched, do not fetch it.
Get the origin of the url
Check if the origin is cached and if so return that
If the origin is not cached, lookup the root icon.
If a root icon is found, store an entry linking the origin url to the root icon url, then return the icon url.
If a root icon is not found, return null.
This would avoid the need to perform a fetch of the document in many cases. For example, when there are several urls per origin, which is quite often given that a website's feed generally points to articles from that website. But also in the case of meta feeds like Google news, it points to articles from the same site several times.

I am concerned right now that the double request isn't respecting the cache, even though I would assume the requests are coalesced. This is something to also look into.

The net result would be less network overhead per lookup, and a significantly reduced cache size. There would be some inaccuracy when a single page's custom favicon differs from the origin's favicon, but I think for the purposes of this app that is fine. The generality of the favicon module should favor its purpose in this app over being accurate and spec compliant across all projects.

# TODO: Check reachability of in page favicons

If i find favicon in page, I currently do not send a HEAD request for it, and this leads to not actually finding the url. This means I have to actually ping in page urls and check if they are valid. Which means I think that find in page icon url function needs to also be async.

I might also need to use Promise.all or Promise.race, to more easily fallback to other possible candidate link elements.

# TODO: Improve favicon lookup failure behavior

Problem with not finding favicons. If there is no favicon for page or its redirect url or its domain, I still keep sending out HEAD requests every single time, indefinitely. This is horrible. I need a way to prevent future requests for some period of time, so that such requests auto fail without any network activity for some period of time.

What about storing a request failure count per icon or something to that effect. Then when failing to fetch, updating the request failure count. Then if count reaches 10 or something, then delete or store a permanently unreachable flagged entry. This would tolerate being temporarily unreachable better?

# Think about revealing API surface pattern

Similar to how you do something like:

  const server = createServer(...);
  server.doStuff();

I could do something like:

  const fi_service = open_fi_service();
  fi_service.lookup();
  fi_service.compact();
  fi_service.close();

Then, the only global exported is open_fi_service.

I kind of like it.

* I tied into how lookup, compact and close are dependent on open.
* It minimizes globals
* It is consistent with how other APIs approach things, it has been done before
* It restricts access to functionality correctly, e.g. cannot call compact
before open ...
* It encapsulates indexedDB. The returned object has an api that wraps calls
so there is no need to pass around the instance of IDBDatabase, or expose it
in any way. It does not even need to be a parameter to later function calls
because it becomes part of the internal state.
* On the other hand it demands indexedB? I dunno maybe all the other functions
can check if conn is present and react accordingly.
