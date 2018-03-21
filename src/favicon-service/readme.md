
Provides a way to get the favicon image url for a page url

### Options to lookup


// Options:
//
// * console {Object} optional, a console object where logging information is
// sent. If not specified then a goes-nowhere-stub is used which effectively
// means no logging.
// * conn {IDBDatabase} optional, an open database connection to the favicon
// cache. If specified then the lookup will interact with the cache. If not
// specified then a cacheless lookup is done.
// * maxFailureCount {Number} optional, if the lookup detects that too many
// failures have been recorded in the cache then the lookup will exit early. If
// a cache is provided and the lookup fails then a corresponding failure will be
// recorded. Failures are aggregated by origin to limit the  amount of failure
// entries in the cache.
// * skipURLFetch {Boolean} optional, defaults to false, whether to skip
// attempting to fetch the html of the input url
// * maxAge {Number} optional, integer, the
// number of millis after which an entry is considered to have expired
// * fetchHTMLTimeout {Number} optional, integer, number of millis to wait
// before considering an attempt to fetch the html of a url a failure
// * fetchImageTimeout {Number} optional, integer, number of millis to wait
// before considering an attempt to fetch an image (response to HEAD request) is
// a failure
// * minImageSize {Number} optional, minimum size in bytes of an image for it to
// be considered a valid favicon
// * maxImageSize {Number} optional, maximum size in bytes of an image for it to
// be considered a valid favicon
// * url {URL} required, the url to lookup, typically some webpage
// * document {Document} optional, pre-fetched document that should be specified
// if the page was previously fetched

### head_image todo
rather than return undefined in the event of an error, this should guarantee a defined response is returned in the non-exception case, similar to the internals of url-loader API calls. The caller should be checking response.ok and not if response defined. Furthermore, the !response.ok check here should be removed, and the range check should be modified to be within if(response.ok) block

# Test todos:

* actually run tests instead of command line
* test offline
* test a non-existent host
* test a known host with origin /favicon.ico
* test a known host with <link> favicon
* test a non-expired cached input url
* test a non-expired cached redirect url
* test a non-expired cached origin url
* same as above 3 but expired
* test against icon with byte size out of bounds
* test cacheless versus caching?
* test compact
* reintroduce dependency on html-parser
