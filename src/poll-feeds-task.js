// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

// TODO: rename to poll-feeds-task

function PollFeedsTask() {
  this.log = new LoggingService();
  this.openDBTask = new OpenFeedDbTask();
  this.updateBadgeTask = new UpdateBadgeTask();
  this.getAllFeedsTask = new GetAllFeedsTask();
  this.fetchFeedTask = new FetchFeedTask();
  this.findEntryTask = new FindEntryTask();
  this.fetchHTMLTask = new FetchHTMLTask();
  this.setImageDimensionsTask = new SetImageDimensionsTask();
  this.updateFeed = updateFeed;
  this.addEntry = addEntry;
  this.Feed = Feed;
  this.Entry = Entry;
  this.rewriteURL = rdr.rewriteURL;
}

// @param verbose {boolean} if true, logs messages to console
// @param forceResetLock {boolean} if true then polling continues even when
// locked
// @param allowMetered {boolean} if true then allow polling to
// continue on a metered connection
PollFeedsTask.prototype.start = function(forceResetLock, allowMetered) {
  this.log.log('Checking for new articles...');
  const ctx = {'numFeedsPending': 0};

  if(!this.acquireLock(forceResetLock)) {
    this.log.warn('Poll is locked');
    this.onComplete(ctx);
    return;
  }

  if('onLine' in navigator && !navigator.onLine) {
    this.log.warn('canceling poll as offline');
    this.onComplete(ctx);
    return;
  }

  // This is experimental
  if(!allowMetered && 'NO_POLL_METERED' in localStorage &&
    navigator.connection && navigator.connection.metered) {
    this.log.debug('canceling poll as on metered connection');
    this.onComplete(ctx);
    return;
  }

  if('ONLY_POLL_IF_IDLE' in localStorage) {
    this.log.debug('checking idle state');
    const idlePeriodSecs = 30;
    chrome.idle.queryState(idlePeriodSecs,
      this.onQueryIdleState.bind(this, ctx));
  } else {
    this.openDBTask.open(this.openDBOnSuccess.bind(this, ctx),
      this.openDBOnError.bind(this, ctx));
  }
};

PollFeedsTask.prototype.onQueryIdleState = function(ctx, state) {
  this.log.debug('idle state:', state);
  if(state === 'locked' || state === 'idle') {
    this.openDBTask.open(this.openDBOnSuccess.bind(this, ctx),
      this.openDBOnError.bind(this, ctx));
  } else {
    this.onComplete(ctx);
  }
};

PollFeedsTask.prototype.openDBOnSuccess = function(ctx, event) {
  this.log.debug('connected to feed database');
  ctx.db = event.target.result;
  this.getAllFeedsTask.start(ctx.db, this.onGetAllFeeds.bind(this, ctx));
};

PollFeedsTask.prototype.openDBOnError = function(ctx, event) {
  this.log.error(event.target.error);
  this.onComplete(ctx);
};

PollFeedsTask.prototype.onGetAllFeeds = function(ctx, feeds) {
  this.log.debug('loaded %s feeds from database', feeds.length);
  if(!feeds.length) {
    this.onComplete(ctx);
    return;
  }

  ctx.numFeedsPending = feeds.length;
  const shouldExcludeEntries = false;
  for(let feed of feeds) {
    this.fetchFeedTask.start(new URL(this.Feed.getURL(feed)),
      shouldExcludeEntries, this.onFetchFeed.bind(this, ctx, feed));
  }
};

PollFeedsTask.prototype.onFetchFeed = function(ctx, localFeed, event) {
  if(event.type !== 'success') {
    this.log.debug('failed to fetch', this.Feed.getURL(localFeed));
    ctx.numFeedsPending--;
    this.onComplete(ctx);
    return;
  }

  this.log.debug('fetched', this.Feed.getURL(localFeed));

  const remoteFeed = event.feed;

  // If the feed has updated in the past, then check if it has been modified.
  // dateUpdated is not set for newly added feeds.
  if(localFeed.dateUpdated && this.isFeedUnmodified(localFeed, remoteFeed)) {
    this.log.debug('remote feed file not modified since last visit',
      this.Feed.getURL(remoteFeed));
    ctx.numFeedsPending--;
    this.onComplete(ctx);
    return;
  }

  const feed = this.Feed.merge(localFeed, remoteFeed);
  this.log.debug('Updating', this.Feed.getURL(feed));
  this.updateFeed(ctx.db, feed,
    this.onUpdateFeed.bind(this, ctx, event.entries));
};

PollFeedsTask.prototype.isFeedUnmodified = function(localFeed, remoteFeed) {
  return localFeed.dateLastModified && remoteFeed.dateLastModified &&
    localFeed.dateLastModified.getTime() ===
    remoteFeed.dateLastModified.getTime()
};

PollFeedsTask.prototype.onUpdateFeed = function(ctx, entries, event) {
  // If we failed to update the feed, then do not even bother updating its
  // entries. Something is seriously wrong. Perhaps this should even be a
  // fatal error.
  if(event.type !== 'success') {
    ctx.numFeedsPending--;
    this.onComplete(ctx);
    return;
  }

  if(!entries.length) {
    ctx.numFeedsPending--;
    this.onComplete(ctx);
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

  const boundOnEntryProcessed = this.onEntryProcessed.bind(this, ctx,
    feedContext);
  for(let entry of entries) {
    this.processEntry(ctx, event.feed, entry, boundOnEntryProcessed);
  }
};

PollFeedsTask.prototype.processEntry = function(ctx, feed, entry, callback) {
  const entryTerminalURLString = this.Entry.getURL(entry);

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
  const rewrittenURLObject = this.rewriteURL(entryTerminalURLObject);
  if(rewrittenURLObject) {
    this.Entry.addURL(entry, rewrittenURLObject.href);
  }

  // Check if the entry already exists. Check against all of its urls
  const matchLimit = 1;
  this.findEntryTask.start(ctx.db, entry.urls, matchLimit,
    this.onFindEntry.bind(this, ctx, feed, entry, callback));
};

PollFeedsTask.prototype.onFindEntry = function(ctx, feed, entry, callback,
  matches) {

  // The entry already exists if there was at least one match
  if(matches.length) {
    // this.log.debug('Found %s matching entries', matches.length);
    callback();
    return;
  }

  entry.feed = feed.id;

  // TODO: I should be looking up the entry's own favicon
  if(feed.faviconURLString) {
    entry.faviconURLString = feed.faviconURLString;
  }

  // This denormalization avoids
  // the need to query for the feed's title when displaying the entry. The
  // catch is that if a feed's title later changes, the change is not
  // reflected in entry's previously stored.
  // feed.title was sanitized earlier when updating the feed
  if(feed.title) {
    entry.feedTitle = feed.title;
  }

  const entryTerminalURLString = this.Entry.getURL(entry);
  const entryTerminalURLObject = new URL(entryTerminalURLString);

  // Check that the url does not belong to a domain that obfuscates its content
  // with things like advertisement interception or full javascript. While these
  // documents can be fetched, there is no point to doing so. We still want to
  // store the entry, but we just do not try and augment its content.
  if(rdr.poll.isFetchResistantURL(entryTerminalURLObject)) {
    this.prepLocalDoc(entry);
    this.addEntry(ctx.db, entry, callback);
    return;
  }

  // Check if the entry url points to a PDF. This limits the amount of
  // networking in the general case, even though the extension isn't a real
  // indication of the mime type and may have some false positives. Even if
  // this misses it, false negatives are not too important.
  if(this.isPDFURL(entryTerminalURLObject)) {
    this.prepLocalDoc(entry);
    this.addEntry(ctx.db, entry, callback);
    return;
  }

  const timeoutMs = 10 * 1000;
  this.fetchHTMLTask.start(entryTerminalURLObject, timeoutMs,
    this.onFetchEntry.bind(this, ctx, entry, callback));
};

PollFeedsTask.prototype.isPDFURL = function(url) {
  // The min len test is here just to reduce regex calls
  const minLength = '/a.pdf'.length;
  const path = url.pathname;
  // TODO: maybe path.toLowerCase().endsWith is simpler, maybe even faster
  // Is it faster to lowercase the string or to search case insensitively, or
  // is this microoptimization that is dumb
  // Does the path (which excludes the '?' and trailing text) end with
  // '.pdf', case insensitive
  return path && path.length > minLength && /\.pdf$/i.test(path)
};

PollFeedsTask.prototype.onFetchEntry = function(ctx, entry, callback, event) {
  if(event.type !== 'success') {
    this.prepLocalDoc(entry);
    this.addEntry(ctx.db, entry, callback);
    return;
  }

  // Append the response url in case of a redirect
  const responseURLString = event.responseURL.href;

  // There should always be a response url, even if no redirect occurred
  if(!responseURLString) {
    throw new Error('missing response url');
  }

  this.Entry.addURL(entry, responseURLString);

  // TODO: if we successfully fetched the entry, then before storing it,
  // we should be trying to set its faviconURL.
  // TODO: actually maybe this should be happening whether we fetch or not
  // - i shouldn't be using the feed's favicon url, that is unrelated
  // - i should pass along the html of the associated html document. the
  // lookup should not fetch a second time.
  // - i should be querying against the redirect url

  const doc = event.document;
  rdr.poll.lazyimg.updateImages(doc);
  rdr.cleandom.filterSourcelessImages(doc);
  rdr.cleandom.filterInvalidAnchors(doc);
  rdr.poll.resolve.start(doc, event.responseURL);
  rdr.poll.tracking.filterImages(doc);
  const cb = this.onSetImageDimensions.bind(this, ctx, entry, doc, callback);
  this.setImageDimensionsTask.start(doc, cb);
};

PollFeedsTask.prototype.onSetImageDimensions = function(ctx, entry, document,
  callback, numImagesModified) {

  if(!document) {
    throw new TypeError('mising document param');
  }

  this.prepDoc(document);
  entry.content = document.documentElement.outerHTML.trim();
  this.addEntry(ctx.db, entry, callback);
};

PollFeedsTask.prototype.prepDoc = function(doc) {
  rdr.bp.filter(doc);
  rdr.cleandom.cleanDoc(doc);
  rdr.cleandom.addNoReferrer(doc);
};

PollFeedsTask.prototype.prepLocalDoc = function(entry) {
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

    this.prepDoc(doc);
    entry.content = doc.documentElement.outerHTML.trim();
  } catch(error) {
  }
};

PollFeedsTask.prototype.onEntryProcessed = function(ctx, feedContext, event) {
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
      this.updateBadgeTask.start(ctx.db);
    }

    ctx.numFeedsPending--;
    this.onComplete(ctx);
  }
};

// Called whenever a feed finishes processing, or when there
// were no feeds to process.
PollFeedsTask.prototype.onComplete = function(ctx) {

  // TODO: this is undefined once for some reason
  if(!ctx) {
    throw new Error('ctx is undefined');
  }

  if(ctx.numFeedsPending) {
    return;
  }

  this.log.log('Polling completed');
  rdr.notifications.show('Updated articles',
    'Completed checking for new articles');
  if(ctx.db) {
    ctx.db.close();
  }

  this.releaseLock();
};

// Obtain a poll lock by setting a flag in local storage. This uses local
// storage instead of global scope because the background page that calls out
// to poll.start occassionally unloads and reloads itself instead of remaining
// persistently open, which resets the value of a global variable.
PollFeedsTask.prototype.acquireLock = function(forceResetLock) {

  if(forceResetLock) {
    this.releaseLock();
  }

  if('POLL_IS_ACTIVE' in localStorage) {
    this.log.debug('failed to acquire lock, the lock is already present');
    return false;
  }

  this.log.debug('acquiring poll lock');
  localStorage.POLL_IS_ACTIVE = '1';
  return true;
};

PollFeedsTask.prototype.releaseLock = function() {
  if('POLL_IS_ACTIVE' in localStorage) {
    this.log.debug('releasing poll lock');
    delete localStorage.POLL_IS_ACTIVE;
  }
};
