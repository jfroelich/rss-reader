
# About

Checks for new feed content in the background.

# TODO

* regarding addEntryToDb, deprecate in favor of put, and after moving
sanitization and default props out, maybe make a helper function
* ensure entries added by putEntryInDb, if not have id, have unread flag and
date created
* filterTrackingImages should accept a base url parameter, and should not
filter images from that host. This way, feeds from that host still work
* regarding shouldExcludeEntryBasedOnURL, the individual tests should probably
involve regular expressions so that I do not need to test against url
variations (like leading www.).
* is isValidEntryURL, think of a better way to implement the hack for a bad feed
that includes extra slashes in its url. maybe it does not belong in this
function
* think of a way to allow easier configuration of filterTrackingImages instead
of hardcoding the arrays
