
# Regarding await of updateBadgeText

Callers should not need to await this. conn.close in calling context
implicitly waits for outstanding requests to complete so long as those
requests were issued while conn was active. Update all call sites to not
await this. Make a note at each call site to remember this, because this is
precisely what I keep forgetting. It is ok to call conn.close even if
requests are outstanding. All it does is enqueue a request to close that
starts once existing requests settle.
