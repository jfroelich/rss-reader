// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

{ // Begin file block scope

// @param forceResetLock {boolean} if true then polling continues even when
// locked
// @param allowMeteredConnections {boolean} if true then allow polling to
// continue on a metered connection
function pollFeeds(forceResetLock, allowMeteredConnections) {
  console.log('Checking for new articles...');

  const context = {'numFeedsPending': 0, 'connection': null};

  if(forceResetLock) {
    releasePollLock();
  }

  if(isPollLocked()) {
    console.warn('Already running');
    onPollComplete.call(context);
    return;
  }

  acquirePollLock();

  if('onLine' in navigator && !navigator.onLine) {
    console.warn('Offline');
    onPollComplete.call(context);
    return;
  }

  // There currently is no way to set this flag in the UI, and
  // navigator.connection is still experimental.
  if(!allowMeteredConnections && 'NO_POLL_METERED' in localStorage &&
    navigator.connection && navigator.connection.metered) {
    console.debug('Metered connection');
    onPollComplete.call(context);
    return;
  }

  // Check if idle and possibly cancel the poll or continue with polling
  if('ONLY_POLL_IF_IDLE' in localStorage) {
    const idlePeriodSecs = 30;
    chrome.idle.queryState(idlePeriodSecs, onQueryIdleState.bind(context));
  } else {
    openDB(onOpenDB.bind(context));
  }
}

function onQueryIdleState(state) {
  if(state === 'locked' || state === 'idle') {
    openDB(onOpenDB.bind(this));
  } else {
    console.debug('Idle state', state);
    onPollComplete.call(this);
  }
}

function onOpenDB(connection) {
  if(connection) {
    this.connection = connection;
    const tx = connection.transaction('feed');
    const store = tx.objectStore('feed');
    const request = store.openCursor();
    request.onsuccess = openFeedCursorOnSuccess.bind(this);
    request.onerror = openFeedCursorOnError.bind(this);
  } else {
    onPollComplete.call(this);
  }
}

function openFeedCursorOnError(event) {
  onPollComplete.call(this);
}

function openFeedCursorOnSuccess(event) {
  const cursor = event.target.result;
  if(!cursor) {
    onPollComplete.call(this);
    return;
  }

  this.numFeedsPending++;
  const feed = cursor.value;
  const shouldExcludeEntries = false;
  const feedURLString = getFeedURL(feed);
  const feedURLObject = new URL(feedURLString);
  const boundOnFetchFeed = onFetchFeed.bind(this, feed);
  fetchFeed(feedURLObject, shouldExcludeEntries, boundOnFetchFeed);
  cursor.continue();
}

function onFetchFeed(localFeed, event) {
  if(event.type !== 'success') {
    this.numFeedsPending--;
    onPollComplete.call(this);
    return;
  }

  const remoteFeed = event.feed;
  if(isFeedUnmodified(localFeed, remoteFeed)) {
    this.numFeedsPending--;
    onPollComplete.call(this);
    return;
  }

  // TODO: I should probably do the feed merge prior to lookup up the favicon,
  // then I do not need to pass around both feeds to continuations. This is the
  // terminal point where both feeds need to be considered separately, so it
  // makes the most sense to do it here, not later.

  // TODO: I don't need to be updating the favicon on every single fetch. I
  // think this can be done on a separate timeline.

  // TODO: this could be more idiomatic with a function. Something like
  // get_remote_feed_url_to_use_to_find_favicon

  const remoteFeedURLString = getFeedURL(remoteFeed);
  const remoteFeedURLObject = new URL(remoteFeedURLString);

  const feedFaviconPageURL = remoteFeed.link ? new URL(remoteFeed.link) :
    remoteFeedURLObject;
  const boundOnLookup = onLookupFeedFavicon.bind(this, localFeed, remoteFeed,
    event.entries);
  const prefetchedDoc = null;
  lookupFavicon(feedFaviconPageURL, prefetchedDoc, boundOnLookup);
}

function isFeedUnmodified(localFeed, remoteFeed) {

  // dateUpdated represents the date the feed was last stored in the database
  // as a result of calling updateFeed. It is not set as a result of calling
  // addFeed. When subscribing to a new feed, only the feed's properties are
  // stored, and not its entries, so that the subscription process is fast. As a
  // result, we always want to poll its entries. Therefore, we need to look at
  // whether dateUpdated has been set to avoid the issue where the entries are
  // never processed during the time period after subscribing where the feed
  // file was not modified.
  if(!localFeed.dateUpdated) {
    return false;
  }

  return localFeed.dateLastModified && remoteFeed.dateLastModified &&
    localFeed.dateLastModified.getTime() ===
    remoteFeed.dateLastModified.getTime()
}

function onLookupFeedFavicon(localFeed, remoteFeed, entries, faviconURL) {
  if(faviconURL) {
    remoteFeed.faviconURLString = faviconURL.href;
  }

  const feed = mergeFeeds(localFeed, remoteFeed);
  updateFeed(this.connection, feed, onUpdateFeed.bind(this, entries));
}

function onUpdateFeed(entries, event) {
  // If we failed to update the feed, then do not even bother updating its
  // entries. Something is seriously wrong. Perhaps this should even be a
  // fatal error.
  if(event.type !== 'success') {
    this.numFeedsPending--;
    onPollComplete.call(this);
    return;
  }

  console.assert(entries);

  // TODO: should this check occur earlier?
  if(!entries.length) {
    this.numFeedsPending--;
    onPollComplete.call(this);
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

  const boundOnEntryProcessed = onEntryProcessed.bind(this, feedContext);
  for(let entry of entries) {
    processEntry.call(this, event.feed, entry, boundOnEntryProcessed);
  }
}

function processEntry(feed, entry, callback) {
  const entryTerminalURLString = getEntryURL(entry);

  // I would prefer this to be an assert, but I think this is the first place
  // where this is validated, and this isn't a fatal error. It just means we
  // parsed the entry from the feed but failed to find a url for it, so we
  // cannot store it, because we require entries have urls.
  // Perhaps what I would rather do is some type of earlier filter of entries
  // without urls, so that this can just be an assert, and so that the
  // responsibility of who does this is explicit
  if(!entryTerminalURLString) {
    console.warn('Entry missing url', entry);
    callback();
    return;
  }

  // Rewrite the entry url
  const entryTerminalURLObject = new URL(entryTerminalURLString);
  const rewrittenURLObject = rewriteURL(entryTerminalURLObject);
  if(rewrittenURLObject) {
    appendEntryURL(entry, rewrittenURLObject.href);
  }

  // Check if the entry already exists. Check against all of its urls
  const matchLimit = 1;
  findEntriesByURLs(this.connection, entry.urls, matchLimit,
    onFindMatchingEntries.bind(this, feed, entry, callback));
}

function onFindMatchingEntries(feed, entry, callback, matches) {
  // The entry already exists if there was at least one match
  if(matches.length) {
    // console.debug('Found matching entries', matches.length);
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

  const entryTerminalURLString = getEntryURL(entry);
  const entryTerminalURLObject = new URL(entryTerminalURLString);

  // Check that the url does not belong to a domain that obfuscates its content
  // with things like advertisement interception or full javascript. While these
  // documents can be fetched, there is no point to doing so. We still want to
  // store the entry, but we just do not try and augment its content.
  if(isFetchResistantURL(entryTerminalURLObject)) {
    prepLocalEntryDoc(entry);
    addEntry(this.connection, entry, callback);
    return;
  }

  // Check if the entry url does not point to a PDF. This limits the amount of
  // networking in the general case, even though the extension isn't a real
  // indication of the mime type and may have some false positives. Even if
  // this misses it, responseXML will be undefined in fetchHTML so false
  // negatives are not too important.
  if(isPDFURL(entryTerminalURLObject)) {
    prepLocalEntryDoc(entry);
    addEntry(this.connection, entry, callback);
    return;
  }

  const timeoutMs = 10 * 1000;
  const boundOnFetchEntry = onFetchEntry.bind(this, entry, callback);
  fetchHTML(entryTerminalURLObject, timeoutMs, boundOnFetchEntry);
}

function isPDFURL(url) {
  // The min len test is here just to reduce regex calls
  const minLength = '/a.pdf'.length;
  const path = url.pathname;
  return path && path.length > minLength && /\.pdf$/i.test(path)
}

function onFetchEntry(entry, callback, event) {
  if(event.type !== 'success') {
    prepLocalEntryDoc(entry);
    addEntry(this.connection, entry, callback);
    return;
  }

  // Append the response url in case of a redirect
  const responseURLString = event.responseURL.href;
  // There should always be a response url, even if no redirect occurred
  console.assert(responseURLString);
  appendEntryURL(entry, responseURLString);

  // TODO: if we successfully fetched the entry, then before storing it,
  // we should be trying to set its faviconURL.
  // TODO: actually maybe this should be happening whether we fetch or not
  // - i shouldn't be using the feed's favicon url, that is unrelated
  // - i should pass along the html of the associated html document. the
  // lookup should not fetch a second time.
  // - i should be querying against the redirect url

  const doc = event.document;
  transformLazyImages(doc);
  filterSourcelessImages(doc);
  cleandom.filterInvalidAnchors(doc);
  resolveDocumentURLs(doc, event.responseURL);
  filterTrackingImages(doc);
  const boundOnSetImageDimensions = onSetImageDimensions.bind(this, entry, doc,
    callback);
  setImageDimensions(doc, boundOnSetImageDimensions);
}

function onSetImageDimensions(entry, document, callback, numImagesModified) {
  console.assert(document);
  prepDoc(document);
  entry.content = document.documentElement.outerHTML.trim();
  addEntry(this.connection, entry, callback);
}

function prepDoc(doc) {
  filterBoilerplate(doc);
  cleandom.cleanDoc(doc);
  cleandom.addNoReferrer(doc);
}

function prepLocalEntryDoc(entry) {
  if(!entry.content) {
    return;
  }

  // Clean the current entry content
  const parser = new DOMParser();
  try {
    const doc = parser.parseFromString(entry.content, 'text/html');
    console.assert(!doc.querySelector('parsererror'));
    prepDoc(doc);
    entry.content = doc.documentElement.outerHTML.trim();
  } catch(error) {
    console.warn(error);
  }
}

function onEntryProcessed(feedContext, event) {
  feedContext.numEntriesProcessed++;
  const count = feedContext.numEntriesProcessed;
  console.assert(count <= feedContext.numEntries);

  if(event && event.type === 'success') {
    feedContext.numEntriesAdded++;
  }

  if(count === feedContext.numEntries) {
    if(feedContext.numEntriesAdded) {
      updateBadge(this.connection);
    }

    this.numFeedsPending--;
    onPollComplete.call(this);
  }
}

// Called whenever a feed finishes processing, or when there
// were no feeds to process.
function onPollComplete() {
  if(this.numFeedsPending) {
    return;
  }

  showDesktopNotification('Updated articles',
    'Completed checking for new articles');
  if(this.connection) {
    this.connection.close();
  }

  releasePollLock();
  console.log('Polling completed');
}

// Obtain a poll lock by setting a flag in local storage. This uses local
// storage instead of global scope because the background page that calls out
// to poll.start occassionally unloads and reloads itself instead of remaining
// persistently open, which would reset the value of the global scope variable
// each page load. When polling determines if the poll is locked, it only
// checks for the presence of the key, and ignores the value, so the value I
// specify here is unimportant.
function acquirePollLock() {
  localStorage.POLL_IS_ACTIVE = '1';
}

function releasePollLock() {
  delete localStorage.POLL_IS_ACTIVE;
}

function isPollLocked() {
  return 'POLL_IS_ACTIVE' in localStorage;
}

this.pollFeeds = pollFeeds;

} // End file block scope
