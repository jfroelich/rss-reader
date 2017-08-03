
# About

Checks for new feed content in the background.

# TODO

* Document functions with comments
* regarding addEntryToDb, deprecate in favor of put, and after moving
sanitization and default props out, maybe make a helper function
* ensure entries added by putEntryInDb, if not have id, have unread flag and
date created
* filter_tracking_imgs should accept a base url parameter, and should not
filter images from that host. This way, feeds from that host still work
* regarding shouldExcludeEntryBasedOnURL, the individual tests should probably
involve regular expressions so that I do not need to test against url
variations (like leading www.).
* is isValidEntryURL, think of a better way to implement the hack for a bad feed
that includes extra slashes in its url. maybe it does not belong in this
function
* think of a way to allow easier configuration of filter_tracking_imgs instead
of hardcoding the arrays

# NOTES

Polling may report itself as completed in the console, and then additional
fetch messages may appear. This is because I race timeouts against fetches,
and if a timeout wins I consider the request timed out and continue polling,
but there is no native way to abort/cancel the other request. So the other
request still eventually times out or eventually completes successfully, but it
could be any time after. So it is safe to ignore these messages, and there is no
issue with my concurrency. This is simply a flaw in how the people that designed
the new JS fetch api implemented fetch. They failed to provide the ability to
cancel the fetch promise or at least have a timeout parameter. Furthermore, I
cannot fallback to XMLHttpRequest, due to cookies and other issues.
