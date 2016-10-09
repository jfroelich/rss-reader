// See license.md

'use strict';

/*
TODO: profiling shows this is one of the slowest functions of the
backend polling process. It is probably the length of time it takes to do
the index lookup. Maybe there is a way to speed it up. Maybe part of the
issue is that I am deserializing entries, and it would be faster to use
a keyed cursor and just return entry ids. After all, I know that the one
calling context where this function is called is in polling, and that is
just to check if an entry exists. If I use a keyCursor then maybe idb is
smart enough to skip the deserialization of the full entry.

TODO: it doesn't actually make sense to always lookup all urls here.
Right now I merely stop appending matches, but I still continue to perform
all lookups. It would be better to not even continue to do lookups if I
reached the limit. Therefore I shouldn't be using a for loop. I should be
using continuation calling to reach the end, and at each async step,
deciding whether to do the next step or end. It is all serial in the end,
because even though the lookups are async, I don't think there is any
performance benefit to doing them in parallel. If all entries are going
to be iterated, then the same amount of work has to occur.
Well, there is a benefit to doing concurrent reads. The issue is that I think
it actually takes longer to call any request after the first.
Or maybe the reads are fast than this is hanging on some external tx
*/


{

function findEntry(conn, urls, limit, verbose, callback) {

  if(!urls.length) {
    throw new Error('at least one url is required');
  }

  const log = new LoggingService();
  log.enabled = verbose;
  log.log('find entries with urls', urls);

  const ctx = {};
  ctx.log = log;
  ctx.didCallback = false;
  ctx.matches = [];
  ctx.callback = callback;
  ctx.limit = limit || 0;
  ctx.reachedLimit = false;

  const tx = conn.transaction('entry');
  tx.oncomplete = onComplete.bind(ctx);
  const store = tx.objectStore('entry');
  const index = store.index('urls');

  // The urls input generally comes from an array of urls, where the earlier
  // urls have redirected or been rewritten to the later urls. The later url
  // is what is most likely to match then in cases where two entries are the
  // same due to redirects. By reversing, this searches for the redirected urls
  // first, before the original urls. Redirected urls are more likely to be
  // found, which can lead to fewer cursor requests and an earlier exit.
  // Shallow clone because reverse mutates and as policy want to avoid
  // mutating parameters.
  // I could skip clone and just iterate in reverse but this is terser.
  let reversed = [...urls];
  reversed.reverse();

  // Fire off concurrent requests for each of the input urls
  for(let url of reversed) {
    // TODO: was normalization already done implicitly?
    const normURL = Entry.normalizeURL(url);
    const request = index.openCursor(normURL);
    request.onsuccess = openCursorOnSuccess.bind(ctx);
    request.onerror = openCursorOnError.bind(ctx);
  }
}

function openCursorOnSuccess(event) {
  if(this.reachedLimit) {
    this.log.debug('ignoring entry because limit reached');
    return;
  }

  const cursor = event.target.result;
  if(!cursor) {
    this.log.debug('undefined cursor');
    return;
  }

  const entry = cursor.value;

  this.log.debug('appending match', Entry.getURL(entry));
  // TODO: avoid pushing dups
  this.matches.push(entry);

  if(this.limit && this.matches.length >= this.limit) {
    this.log.debug('reached limit');
    this.reachedLimit = true;
    return;
  }

  cursor.continue();
}

function openCursorOnError(event) {
  this.log.error(event.target.error);
};

function onComplete() {
  this.log.log('Found %s matches', this.matches.length);
  this.callback(this.matches);
}

this.findEntry = findEntry;

}
