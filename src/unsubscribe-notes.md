
#TODO


#NOTES

It was tempting to not await updateBadgeText but I realized that it relies on
the connection being open. If not awaited then the caller could close the
connection while updateBadgeText is running. This is the consequence of sharing
the connection. If I did not share then unsubscribe could complete prior to
updateBadgeText completing and there would be no need to await.
