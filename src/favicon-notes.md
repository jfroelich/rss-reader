
# About

Provides a simple way to quickly lookup the url of a favicon associated with a
URL. The primary public function is `favicon.lookup`.

The lookup function makes an effort to follow the favicon spec, which sadly is
not extremely well documented. Ignoring the cache lookups, the algorithm
involves the following steps:

1. Fetch the URL.
2. Search the contents of the URL for a <link> specifying the icon.
3. If no icon is found in step 2, check for the icon in the document root.

In addition to lookup, there are two other key functions, connect and compact.
The favicon.connect function opens a connection to indexedDB. The connection is
the first parameter to the lookup function. indexedDB is used to provide a
simple caching mechanism for the lookup, that memoizes certain lookups.

The compact function is a housekeeping function intended to be run rarely and
periodically. It examines the cache for older entries and removes them, which
serves to reduce the cache's size.

The lookup algorithm always checks the URL first, before checking for the
favicon.ico file in the domain's root path, because my understanding of
favicons is that individual pages of a website are allowed to specify an icon
that is unique to the page, and not site wide. Icons in the root are site
wide. Most sites in fact use the site wide icon. But because each page can be
different, I must always check the page, and this cannot be avoided.

# Standalone indexedDB database

indexedDB databases are installed specific to an origin.

This uses a separate database from the reader app. I chose to use a separate
database because this makes this library completely independent of all other
libraries and the app itself. It is less convenient when writing code in the
reader app because I have to open two connections, but it keeps the code
separate. I have some concern because I read somewhere that some platforms
like iOS currently struggle with maintaining multiple indexedDB databases for
a single origin. However, I am not really targeting those platforms right now
so I do not think it is important enough to worry about it.

# About "Refused to load the script" errors that appear in the console

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

I do not currently know how to signal no interest in preload. The RFC states
that it is possible, but I am not sure I can do it from Javascript, and I have
no idea how I would do it from Javascript.

* Maybe I can set the user-agent? Maybe servers are checking user-agent to
decide if preload supported?
* Maybe it has something to do with CORS or caching?

# General todo items

* Add favicon.clearCache utility function to help testing
* Revisit whether favicons are now supported from within a chrome
extension. At least document very clearly why this library has to be used
in the alternative. It may no longer need to exist. This time around, take
better notes as to why I can or cannot use chrome internals.
* lookup is simply too large and needs to be broken up into smaller functions
* Add more logging statements (checking verbose) in favicon.lookup
* When testing, use a test db instead of the real db, and make sure to
delete the test db at the end of the test. favicon.connect accepts an options
object where I can define name/version, and I can custom code a simple delete
database function
* when checking image mime type, maybe be more restrictive about allowed
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
being inadvertently removed from the cache.
* Implement testing code that actually runs tests instead of just lets me
easily run from the command line

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
