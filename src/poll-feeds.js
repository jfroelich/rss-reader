// See license.md

'use strict';

// TODO: use a single favicon cache connection for favicon lookups
// TODO: add is-active feed functionality, do not poll in-active feeds
// TODO: deactivate unreachable feeds
// TODO: deactivate feeds not changed for a long time
// TODO: store deactivation reason in feed
// TODO: store deactivation date

{

function pollFeeds(forceResetLock, allowMetered, log) {
  log.log('Checking for new articles...');
  const ctx = {
    'numFeedsPending': 0,
    'log': log,
    'cache': new FeedCache(log)
  };

  if(!acquireLock.call(ctx, forceResetLock)) {
    log.warn('Poll is locked');
    onComplete.call(ctx);
    return;
  }

  if('onLine' in navigator && !navigator.onLine) {
    log.warn('canceling poll as offline');
    onComplete.call(ctx);
    return;
  }

  // This is experimental
  if(!allowMetered && 'NO_POLL_METERED' in localStorage &&
    navigator.connection && navigator.connection.metered) {
    log.debug('canceling poll as on metered connection');
    onComplete.call(ctx);
    return;
  }

  if('ONLY_POLL_IF_IDLE' in localStorage) {
    log.debug('checking idle state');
    const idlePeriodSecs = 30;
    chrome.idle.queryState(idlePeriodSecs, onQueryIdleState.bind(ctx));
  } else {
    const db = new FeedDb(log);
    db.open(openDBOnSuccess.bind(ctx), openDBOnError.bind(ctx));
  }
}

function onQueryIdleState(state) {
  this.log.debug('idle state:', state);
  if(state === 'locked' || state === 'idle') {
    const db = new FeedDb(this.log);
    db.open(openDBOnSuccess.bind(this), openDBOnError.bind(this));
  } else {
    onComplete.call(this);
  }
}

function openDBOnSuccess(event) {
  this.log.debug('Connected to feed database');
  this.conn = event.target.result;
  this.cache.getAllFeeds(this.conn, onGetAllFeeds.bind(this));
}

function openDBOnError(event) {
  this.log.error(event.target.error);
  onComplete.call(this);
}

function onGetAllFeeds(feeds) {
  if(!feeds.length) {
    onComplete.call(this);
    return;
  }

  this.numFeedsPending = feeds.length;
  const excludeEntries = false;
  for(let feed of feeds) {
    const url = new URL(Feed.getURL(feed));
    fetchFeed(url, excludeEntries, this.log, onFetchFeed.bind(this, feed));
  }
}

function onFetchFeed(localFeed, event) {
  if(event.type !== 'success') {
    this.log.debug('Failed to fetch feed', Feed.getURL(localFeed));
    this.numFeedsPending--;
    onComplete.call(this);
    return;
  }

  const remoteFeed = event.feed;

  // If the feed has updated in the past, then check if it has been modified.
  // dateUpdated is not set for newly added feeds.
  if(localFeed.dateUpdated && isFeedUnmodified(localFeed, remoteFeed)) {
    this.log.debug('Feed not modified', Feed.getURL(remoteFeed));
    this.numFeedsPending--;
    onComplete.call(this);
    return;
  }

  const feed = Feed.merge(localFeed, remoteFeed);
  this.cache.updateFeed(this.conn, feed,
    onUpdateFeed.bind(this, event.entries));
}

function isFeedUnmodified(localFeed, remoteFeed) {
  return localFeed.dateLastModified && remoteFeed.dateLastModified &&
    localFeed.dateLastModified.getTime() ===
    remoteFeed.dateLastModified.getTime()
}

function onUpdateFeed(entries, event) {
  // If we failed to update the feed, then do not even bother updating its
  // entries. Something is seriously wrong. Perhaps this should even be a
  // fatal error.
  if(event.type !== 'success') {
    this.numFeedsPending--;
    onComplete.call(this);
    return;
  }

  if(!entries.length) {
    this.numFeedsPending--;
    onComplete.call(this);
    return;
  }

  // TODO: filter out entries without urls, and then check again against num
  // remaining.
  // TODO: I should be filtering duplicate entries, compared by norm url,
  // somewhere. I somehow lost this functionality, or moved it somewhere

  // TODO: instead of passing along the feed, just shove it in feed ctx
  // and pass along feed ctx instead
  // or just pass along only the relevant fields needed like feedId and title
  // and faviconURLString

  const feedContext = {
    'numEntriesProcessed': 0,
    'numEntriesAdded': 0,
    'numEntries': entries.length
  };

  const boundOnEntryProcessed = onEntryProcessed.bind(this, feedContext);
  for(let entry of entries) {
    processEntry.call(this, event.feed, entry, boundOnEntryProcessed);
  }
}

function processEntry(feed, entry, callback) {
  const url = Entry.getURL(entry);

  if(!url) {
    this.log.warn('Entry missing url', entry);
    callback();
    return;
  }

  const rewrittenURL = rewriteURL(new URL(url));
  if(rewrittenURL) {
    Entry.addURL(entry, rewrittenURL.href);
  }

  const limit = 1;
  this.cache.findEntry(this.conn, entry.urls, limit,
    onFindEntry.bind(this, feed, entry, callback));
}

function onFindEntry(feed, entry, callback, matches) {
  if(matches.length) {
    callback();
    return;
  }

  entry.feed = feed.id;

  // TODO: I should be looking up the entry's own favicon
  if(feed.faviconURLString) {
    entry.faviconURLString = feed.faviconURLString;
  }

  if(feed.title) {
    entry.feedTitle = feed.title;
  }

  const url = new URL(Entry.getURL(entry));
  if(isInterstitialURL(url) || isScriptGeneratedContent(url) ||
    isPDFURL(url)) {
    prepLocalDoc(entry);
    this.cache.addEntry(this.conn, entry, callback);
    return;
  }

  fetchHTML(url, this.log, onFetchEntry.bind(this, entry, callback));
}

function isPDFURL(url) {
  // The min len test is here just to reduce regex calls
  const minLength = '/a.pdf'.length;
  const path = url.pathname;
  // TODO: maybe path.toLowerCase().endsWith is simpler, maybe even faster
  // Is it faster to lowercase the string or to search case insensitively, or
  // is this microoptimization that is dumb
  // Does the path (which excludes the '?' and trailing text) end with
  // '.pdf', case insensitive
  return path && path.length > minLength && /\.pdf$/i.test(path)
}

function onFetchEntry(entry, callback, event) {
  if(event.type !== 'success') {
    prepLocalDoc(entry);
    this.cache.addEntry(this.conn, entry, callback);
    return;
  }

  // Append the response url in case of a redirect
  const responseURLString = event.responseURL.href;

  // There should always be a response url, even if no redirect occurred
  if(!responseURLString) {
    throw new Error('missing response url');
  }

  Entry.addURL(entry, responseURLString);

  // TODO: if we successfully fetched the entry, then before storing it,
  // we should be trying to set its faviconURL.
  // TODO: actually maybe this should be happening whether we fetch or not
  // - i shouldn't be using the feed's favicon url, that is unrelated
  // - i should pass along the html of the associated html document. the
  // lookup should not fetch a second time.
  // - i should be querying against the redirect url

  const doc = event.document;
  transformLazyImages(doc);
  DOMScrub.filterSourcelessImages(doc);
  DOMScrub.filterInvalidAnchors(doc);
  resolveDocument(doc, this.log, event.responseURL);
  filterTrackingImages(doc);
  setImageDimensions(doc, this.log,
    onSetImageDimensions.bind(this, entry, doc, callback));
}

function onSetImageDimensions(entry, document, callback, numImagesModified) {
  if(!document) {
    throw new TypeError('mising document param');
  }

  prepDoc(document);
  entry.content = document.documentElement.outerHTML.trim();
  this.cache.addEntry(this.conn, entry, callback);
}

function prepDoc(doc) {
  Boilerplate.filter(doc);
  DOMScrub.cleanDoc(doc);
  DOMScrub.addNoReferrer(doc);
}

function prepLocalDoc(entry) {
  if(!entry.content) {
    return;
  }

  const parser = new DOMParser();
  try {
    const doc = parser.parseFromString(entry.content, 'text/html');

    if(doc.querySelector('parsererror')) {
      entry.content = 'Cannot show document due to parsing error';
      return;
    }

    prepDoc(doc);
    entry.content = doc.documentElement.outerHTML.trim();
  } catch(error) {
  }
}

function onEntryProcessed(feedContext, event) {
  feedContext.numEntriesProcessed++;
  const count = feedContext.numEntriesProcessed;

  if(count > feedContext.numEntries) {
    throw new Error(`count ${count} > numEntries ${numEntries}`);
  }

  if(event && event.type === 'success') {
    feedContext.numEntriesAdded++;
  }

  if(count === feedContext.numEntries) {
    if(feedContext.numEntriesAdded) {
      updateBadge(this.conn, this.log);
    }

    this.numFeedsPending--;
    onComplete.call(this);
  }
}

function onComplete() {
  if(this.numFeedsPending) {
    return;
  }

  this.log.log('Polling completed');
  showNotification('Updated articles',
    'Completed checking for new articles');
  if(this.conn) {
    this.conn.close();
  }

  releaseLock.call(this);
}

// Obtain a poll lock by setting a flag in local storage. This uses local
// storage instead of global scope because the background page that calls out
// to poll.start occassionally unloads and reloads itself instead of remaining
// persistently open, which resets the value of a global variable.
function acquireLock(forceResetLock) {

  if(forceResetLock) {
    releaseLock.call(this);
  }

  if('POLL_FEEDS_ACTIVE' in localStorage) {
    this.log.debug('Failed to acquire lock, the lock is already present');
    return false;
  }

  this.log.debug('Acquiring poll lock');
  localStorage.POLL_FEEDS_ACTIVE = '1';
  return true;
}

function releaseLock() {
  if('POLL_FEEDS_ACTIVE' in localStorage) {
    this.log.debug('Releasing poll lock');
    delete localStorage.POLL_FEEDS_ACTIVE;
  }
}

this.pollFeeds = pollFeeds;

}
