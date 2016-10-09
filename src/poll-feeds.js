// See license.md

'use strict';

/*
- experiment with webworker?
- if repeatedly fail to fetch feed mark it as inactive, don't poll against
inactive feeds
- customizable update schedules per feed
- backoff per feed if poll did not find updated content
- de-activation of feeds with 404s
- de-activation of too much time elapsed since feed had new articles
- only poll if feed is active
- store feed de-activated reason code
- store feed de-activated date
- some concept of throttling updates
- configurable polling schedule, per poll (all feeds) or per maybe per feed
- maybe improve the content of the notification, like show number of articles
added or something
*/

{

function pollFeeds(forceResetLock, allowMetered, verbose) {
  const log = new LoggingService();
  log.enabled = verbose;

  log.log('Checking for new articles...');
  const ctx = {'numFeedsPending': 0, 'log': log};

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
    const feedDb = new FeedDb();
    feedDb.open(openDBOnSuccess.bind(ctx), openDBOnError.bind(ctx));
  }
}

function onQueryIdleState(state) {
  this.log.debug('idle state:', state);
  if(state === 'locked' || state === 'idle') {
    const feedDb = new FeedDb();
    feedDb.open(openDBOnSuccess.bind(this), openDBOnError.bind(this));
  } else {
    onComplete.call(this);
  }
}

function openDBOnSuccess(event) {
  this.log.debug('Connected to feed database');
  this.conn = event.target.result;
  const verbose = false;
  getAllFeeds(this.conn, verbose, onGetAllFeeds.bind(this));
}

function openDBOnError(event) {
  this.log.error(event.target.error);
  onComplete.call(this);
}

function onGetAllFeeds(feeds) {
  this.log.debug('loaded %s feeds from database', feeds.length);
  if(!feeds.length) {
    onComplete.call(this);
    return;
  }

  this.numFeedsPending = feeds.length;
  const excludeEntries = false;
  const verbose = false;
  for(let feed of feeds) {
    const requestURL = new URL(Feed.getURL(feed));
    fetchFeed(requestURL, excludeEntries, verbose,
      onFetchFeed.bind(this, feed));
  }
}

function onFetchFeed(localFeed, event) {
  if(event.type !== 'success') {
    this.log.debug('failed to fetch', Feed.getURL(localFeed));
    this.numFeedsPending--;
    onComplete.call(this);
    return;
  }

  this.log.debug('fetched', Feed.getURL(localFeed));

  const remoteFeed = event.feed;

  // If the feed has updated in the past, then check if it has been modified.
  // dateUpdated is not set for newly added feeds.
  if(localFeed.dateUpdated && isFeedUnmodified(localFeed, remoteFeed)) {
    this.log.debug('remote feed file not modified since last visit',
      Feed.getURL(remoteFeed));
    this.numFeedsPending--;
    onComplete.call(this);
    return;
  }

  const feed = Feed.merge(localFeed, remoteFeed);
  this.log.debug('Updating', Feed.getURL(feed));
  const verbose = false;
  updateFeed(this.conn, feed, verbose, onUpdateFeed.bind(this, event.entries));
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
  const entryTerminalURLString = Entry.getURL(entry);

  // I would prefer this to be an assert, but I think this is the first place
  // where this is validated, and this isn't a fatal error. It just means we
  // parsed the entry from the feed but failed to find a url for it, so we
  // cannot store it, because we require entries have urls.
  // Perhaps what I would rather do is some type of earlier filter of entries
  // without urls, so that this can just be an assert, and so that the
  // responsibility of who does this is explicit
  if(!entryTerminalURLString) {
    this.log.warn('Entry missing url', entry);
    callback();
    return;
  }

  // Rewrite the entry url
  const entryTerminalURLObject = new URL(entryTerminalURLString);
  const rewrittenURLObject = rdr.rewriteURL(entryTerminalURLObject);
  if(rewrittenURLObject) {
    Entry.addURL(entry, rewrittenURLObject.href);
  }

  const limit = 1;
  const verbose = false;
  findEntry(this.conn, entry.urls, limit, verbose,
    onFindEntry.bind(this, feed, entry, callback));
}

function onFindEntry(feed, entry, callback, matches) {

  // The entry already exists if there was at least one match
  if(matches.length) {
    callback();
    return;
  }

  entry.feed = feed.id;

  // TODO: I should be looking up the entry's own favicon
  if(feed.faviconURLString) {
    entry.faviconURLString = feed.faviconURLString;
  }

  // This denormalization avoids the need to query for the feed's title when
  // displaying the entry. Assume feed.title was sanitized.
  if(feed.title) {
    entry.feedTitle = feed.title;
  }

  const entryTerminalURLString = Entry.getURL(entry);
  const entryTerminalURLObject = new URL(entryTerminalURLString);

  // Check that the url does not belong to a domain that obfuscates its content
  // with things like advertisement interception or full javascript. While these
  // documents can be fetched, there is no point to doing so. We still want to
  // store the entry, but we just do not try and augment its content.
  if(rdr.poll.isFetchResistantURL(entryTerminalURLObject)) {
    prepLocalDoc(entry);
    addEntry(this.conn, entry, false, callback);
    return;
  }

  // Check if the entry url points to a PDF. This limits the amount of
  // networking in the general case, even though the extension isn't a real
  // indication of the mime type and may have some false positives. Even if
  // this misses it, false negatives are not too important.
  if(isPDFURL(entryTerminalURLObject)) {
    prepLocalDoc(entry);
    addEntry(this.conn, entry, false, callback);
    return;
  }

  const verbose = false;
  fetchHTML(entryTerminalURLObject, verbose,
    onFetchEntry.bind(this, entry, callback));
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
    addEntry(this.conn, entry, false, callback);
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
  rdr.poll.lazyimg.updateImages(doc);
  DOMScrub.filterSourcelessImages(doc);
  DOMScrub.filterInvalidAnchors(doc);
  rdr.poll.resolve.start(doc, event.responseURL);
  rdr.poll.tracking.filterImages(doc);

  const verbose = false;
  setImageDimensions(doc, verbose,
    onSetImageDimensions.bind(this, entry, doc, callback));
}

function onSetImageDimensions(entry, document, callback, numImagesModified) {

  if(!document) {
    throw new TypeError('mising document param');
  }

  prepDoc(document);
  entry.content = document.documentElement.outerHTML.trim();
  addEntry(this.conn, entry, false, callback);
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
    throw new Error('count ' + count + ' is greater than numEntries ' +
      numEntries);
  }

  if(event && event.type === 'success') {
    feedContext.numEntriesAdded++;
  }

  if(count === feedContext.numEntries) {
    if(feedContext.numEntriesAdded) {
      const verbose = false;
      updateBadge(this.conn, verbose);
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
  rdr.notifications.show('Updated articles',
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
    this.log.debug('failed to acquire lock, the lock is already present');
    return false;
  }

  this.log.debug('acquiring poll lock');
  localStorage.POLL_FEEDS_ACTIVE = '1';
  return true;
}

function releaseLock() {
  if('POLL_FEEDS_ACTIVE' in localStorage) {
    this.log.debug('releasing poll lock');
    delete localStorage.POLL_FEEDS_ACTIVE;
  }
}

this.pollFeeds = pollFeeds;

}
