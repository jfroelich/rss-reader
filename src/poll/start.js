// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

var rdr = rdr || {};
rdr.poll = rdr.poll || {};

// @param verbose {boolean} if true, logs messages to console
// @param forceResetLock {boolean} if true then polling continues even when
// locked
// @param allowMeteredConnections {boolean} if true then allow polling to
// continue on a metered connection
rdr.poll.start = function(verbose, forceResetLock, allowMeteredConnections) {
  if(verbose) {
    console.log('Checking for new articles...');
  }

  const context = {
    'numFeedsPending': 0,
    'db': null,
    'verbose': verbose
  };

  if(forceResetLock) {
    rdr.poll.releaseLock();
  }

  if(!rdr.poll.acquireLock()) {
    if(verbose) {
      console.warn('Poll is locked');
    }

    rdr.poll.onComplete.call(context);
    return;
  }


  if('onLine' in navigator && !navigator.onLine) {
    if(verbose) {
      console.warn('Offline');
    }

    rdr.poll.onComplete.call(context);
    return;
  }

  // This is experimental
  if(!allowMeteredConnections && 'NO_POLL_METERED' in localStorage &&
    navigator.connection && navigator.connection.metered) {
    if(verbose) {
      console.debug('Metered connection');
    }

    rdr.poll.onComplete.call(context);
    return;
  }

  if('ONLY_POLL_IF_IDLE' in localStorage) {
    const idlePeriodSecs = 30;
    chrome.idle.queryState(idlePeriodSecs,
      rdr.poll.onQueryIdleState.bind(context));
  } else {
    rdr.db.open(rdr.poll.onOpenDB.bind(context));
  }
};

rdr.poll.onQueryIdleState = function(state) {
  if(state === 'locked' || state === 'idle') {
    rdr.db.open(rdr.poll.onOpenDB.bind(this));
  } else {
    if(this.verbose) {
      console.debug('Idle state', state);
    }
    rdr.poll.onComplete.call(this);
  }
};

rdr.poll.onOpenDB = function(db) {
  if(!db) {
    if(this.verbose) {
      console.warn('Failed to connect to database');
    }
    rdr.poll.onComplete.call(this);
    return;
  }

  this.db = db;
  rdr.feed.getAll(this.db, rdr.poll.onGetAllFeeds.bind(this));
};

rdr.poll.onGetAllFeeds = function(feeds) {
  if(!feeds.length) {
    rdr.poll.onComplete.call(this);
    return;
  }

  this.numFeedsPending = feeds.length;
  const shouldExcludeEntries = false;
  for(let feed of feeds) {
    rdr.feed.fetch(new URL(rdr.feed.getURL(feed)), shouldExcludeEntries,
      rdr.poll.onFetchFeed.bind(this, feed), this.verbose);
  }
};

rdr.poll.onFetchFeed = function(localFeed, event) {
  if(event.type !== 'success') {
    this.numFeedsPending--;
    rdr.poll.onComplete.call(this);
    return;
  }

  const remoteFeed = event.feed;

  // If the feed has updated in the past, then check if it has been modified.
  // dateUpdated is not set for newly added feeds.
  if(localFeed.dateUpdated &&
    rdr.poll.isFeedUnmodified(localFeed, remoteFeed)) {
    if(this.verbose) {
      console.debug('file not modified', rdr.feed.getURL(remoteFeed));
    }
    this.numFeedsPending--;
    rdr.poll.onComplete.call(this);
    return;
  }

  const feed = rdr.feed.merge(localFeed, remoteFeed);
  rdr.feed.update(this.db, feed,
    rdr.poll.onUpdateFeed.bind(this, event.entries));
};

rdr.poll.isFeedUnmodified = function(localFeed, remoteFeed) {
  return localFeed.dateLastModified && remoteFeed.dateLastModified &&
    localFeed.dateLastModified.getTime() ===
    remoteFeed.dateLastModified.getTime()
};

rdr.poll.onUpdateFeed = function(entries, event) {
  // If we failed to update the feed, then do not even bother updating its
  // entries. Something is seriously wrong. Perhaps this should even be a
  // fatal error.
  if(event.type !== 'success') {
    this.numFeedsPending--;
    rdr.poll.onComplete.call(this);
    return;
  }

  if(!entries) {
    throw new TypeError('missing entries param');
  }

  // TODO: should this check occur earlier?
  if(!entries.length) {
    this.numFeedsPending--;
    rdr.poll.onComplete.call(this);
    return;
  }

  // TODO: filter out entries without urls, and then check again against num
  // remaining.
  // TODO: I should be filtering duplicate entries, compared by norm url,
  // somewhere. I somehow lost this functionality, or moved it somewhere

  // TODO: instead of passing along the feed, just shove it in feed context
  // and pass along feed context instead
  // or just pass along only the relevant fields needed like feedId and title
  // and faviconURLString

  const feedContext = {
    'numEntriesProcessed': 0,
    'numEntriesAdded': 0,
    'numEntries': entries.length
  };

  const boundOnEntryProcessed = rdr.poll.onEntryProcessed.bind(this,
    feedContext);
  for(let entry of entries) {
    rdr.poll.processEntry.call(this, event.feed, entry, boundOnEntryProcessed);
  }
};

rdr.poll.processEntry = function(feed, entry, callback) {
  const entryTerminalURLString = rdr.entry.getURL(entry);

  // I would prefer this to be an assert, but I think this is the first place
  // where this is validated, and this isn't a fatal error. It just means we
  // parsed the entry from the feed but failed to find a url for it, so we
  // cannot store it, because we require entries have urls.
  // Perhaps what I would rather do is some type of earlier filter of entries
  // without urls, so that this can just be an assert, and so that the
  // responsibility of who does this is explicit
  if(!entryTerminalURLString) {
    if(this.verbose) {
      console.warn('Entry missing url', entry);
    }

    callback();
    return;
  }

  // Rewrite the entry url
  const entryTerminalURLObject = new URL(entryTerminalURLString);
  const rewrittenURLObject = rdr.rewriteURL(entryTerminalURLObject);
  if(rewrittenURLObject) {
    rdr.entry.addURL(entry, rewrittenURLObject.href);
  }

  // Check if the entry already exists. Check against all of its urls
  const matchLimit = 1;
  rdr.entry.findByURLs(this.db, entry.urls, matchLimit,
    rdr.poll.onFindEntry.bind(this, feed, entry, callback));
};

rdr.poll.onFindEntry = function(feed, entry, callback, matches) {
  // The entry already exists if there was at least one match
  if(matches.length) {
    if(this.verbose) {
      // console.debug('Found matching entries', matches.length);
    }
    callback();
    return;
  }

  entry.feed = feed.id;
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

  const entryTerminalURLString = rdr.entry.getURL(entry);
  const entryTerminalURLObject = new URL(entryTerminalURLString);

  // Check that the url does not belong to a domain that obfuscates its content
  // with things like advertisement interception or full javascript. While these
  // documents can be fetched, there is no point to doing so. We still want to
  // store the entry, but we just do not try and augment its content.
  if(rdr.poll.isFetchResistantURL(entryTerminalURLObject)) {
    rdr.poll.prepLocalDoc(entry);
    rdr.entry.add(this.db, entry, callback);
    return;
  }

  // Check if the entry url does not point to a PDF. This limits the amount of
  // networking in the general case, even though the extension isn't a real
  // indication of the mime type and may have some false positives. Even if
  // this misses it, responseXML will be undefined in fetchHTML.start so false
  // negatives are not too important.
  if(rdr.poll.isPDFURL(entryTerminalURLObject)) {
    rdr.poll.prepLocalDoc(entry);
    rdr.entry.add(this.db, entry, callback);
    return;
  }

  const timeoutMs = 10 * 1000;
  const boundOnFetchEntry = rdr.poll.onFetchEntry.bind(this, entry, callback);
  rdr.poll.fetchHTML.start(entryTerminalURLObject, timeoutMs,
    boundOnFetchEntry, this.verbose);
};

rdr.poll.isPDFURL = function(url) {
  // The min len test is here just to reduce regex calls
  const minLength = '/a.pdf'.length;
  const path = url.pathname;
  return path && path.length > minLength && /\.pdf$/i.test(path)
};

rdr.poll.onFetchEntry = function(entry, callback, event) {
  if(event.type !== 'success') {
    rdr.poll.prepLocalDoc(entry);
    rdr.entry.add(this.db, entry, callback);
    return;
  }

  // Append the response url in case of a redirect
  const responseURLString = event.responseURL.href;

  // There should always be a response url, even if no redirect occurred
  if(!responseURLString) {
    throw new Error('missing response url');
  }

  rdr.entry.addURL(entry, responseURLString);

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
  const cb = rdr.poll.onSetImageDimensions.bind(this, entry, doc, callback);
  rdr.poll.imgdims.updateImages(doc, cb);
};

rdr.poll.onSetImageDimensions = function(entry, document, callback,
  numImagesModified) {

  if(!document) {
    throw new TypeError('mising document param');
  }

  rdr.poll.prepDoc(document);
  entry.content = document.documentElement.outerHTML.trim();
  rdr.entry.add(this.db, entry, callback);
};

rdr.poll.prepDoc = function(doc) {
  rdr.bp.filter(doc);
  rdr.cleandom.cleanDoc(doc);
  rdr.cleandom.addNoReferrer(doc);
};

rdr.poll.prepLocalDoc = function(entry) {
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

    rdr.poll.prepDoc(doc);
    entry.content = doc.documentElement.outerHTML.trim();
  } catch(error) {
  }
};

rdr.poll.onEntryProcessed = function(feedContext, event) {
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
      rdr.badge.update.start(this.db);
    }

    this.numFeedsPending--;
    rdr.poll.onComplete.call(this);
  }
};

// Called whenever a feed finishes processing, or when there
// were no feeds to process.
rdr.poll.onComplete = function() {
  if(this.numFeedsPending) {
    return;
  }


  if(this.verbose) {
    console.log('Polling completed');
  }

  rdr.notifications.show('Updated articles',
    'Completed checking for new articles');
  if(this.db) {
    this.db.close();
  }

  rdr.poll.releaseLock();
};

// Obtain a poll lock by setting a flag in local storage. This uses local
// storage instead of global scope because the background page that calls out
// to poll.start occassionally unloads and reloads itself instead of remaining
// persistently open, which resets the value of a global variable.
rdr.poll.acquireLock = function() {
  if('POLL_IS_ACTIVE' in localStorage) {
    return false;
  }

  localStorage.POLL_IS_ACTIVE = '1';
  return true;
};

rdr.poll.releaseLock = function() {
  delete localStorage.POLL_IS_ACTIVE;
};
