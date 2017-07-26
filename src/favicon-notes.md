
# About

Given a url, lookup the associated favicon url. Tries to follow the spec by
first checking for the icon in the page, then checking in the domain root.
Tries to use a cache to speed up queries.

Although all functions are currently public, the primary functions are:
* lookup - lookup a favicon
* connect - connect to indexedDB (for conn parameter to lookup)
* compact - scan db and remove old entries


# TODO

* revisit whether favicons are now supported from within a chrome
extension. At least document very clearly why this library has to be used
in the alternative.
* lookup is simply too large and needs to be broken up into smaller functions
* Add more logging statements (checking verbose) in favicon.lookup
* in favicon test, use a test db instead of the real db, and make sure to
delete the test db at the end of the test
** favicon.connect accepts an options object where I can define name/version,
and I can custom code a simple delete database function
* when checking image mime type, maybe be more restrictive about allowed
content type: image/vnd.microsoft.icon, image/png, image/x-icon,
image/webp
* Should findIconInDocument use querySelectorAll?
* For compact, check if indexedDB now supports a range for delete, and see if
there is a simple way of deleting expired entries that does not involve
object deserialization.
* Use the new streaming api when sending a request to get a doc. Use together
with TextDecoder. Stream until <head is found. Then cancel the response. Then
recreate a full html string (append ></html>), then parse that for link tags.
This avoids the need to download the whole document. I do not think accuracy
decreases too much (e.g. fake </head> in a js comment or something is rare).

* maybe I can avoid parsing and just search raw text for
<link> tags, the accuracy loss may be ok given the speed boost

* Look into why I see this log message repeatedly: Fetch finished loading: HEAD "https://github.com/favicon.ico". I should not be seeing this so frequently if
lookups are cached.
