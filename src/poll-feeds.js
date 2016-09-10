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
  // then I do need to pass around both feeds to continuations. This is the
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
    retrun false;
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
  if(event.type !== 'success') {
    this.numFeedsPending--;
    onPollComplete.call(this);
    return;
  }

  if(!entries || !entries.length) {
    this.numFeedsPending--;
    onPollComplete.call(this);
    return;
  }

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

  let entryTerminalURLString = getEntryURL(entry);

  if(!entryTerminalURLString) {
    console.warn('Entry missing url', entry);
    callback();
    return;
  }

  let entryTerminalURLObject = new URL(entryTerminalURLString);
  const rewrittenURLObject = rewriteURL(entryTerminalURLObject);

  if(rewrittenURLObject) {
    appendEntryURL(entry, rewrittenURLObject.href);
  }

  // The terminal url may have changed if it was rewritten and unique
  entryTerminalURLString = getEntryURL(entry);
  entryTerminalURLObject = new URL(entryTerminalURLString);

  // TODO: should normalize append the norm url to entry.urls?

  const normalizedURLObject = normalizeURL(entryTerminalURLObject);

  // TODO: there is another kind normalization I want to add, I think I have to
  // add it in several places (which eventually should just be one place),
  // but the idea is to replace '//' with '/' in path name. Certain feeds some
  // to use invalid urls


  // Temp, testing to see if this was cause of dup call to addEntry
  // console.debug('Searching for entry:', normalizedURLObject.href);

  // TODO: after some thought, I think it is better to have a separate funciton
  // called something like find_entry_by_url, and this should call out to that.
  // It is more idiomatic, and it shortens the code

  const tx = this.connection.transaction('entry');
  const store = tx.objectStore('entry');
  const index = store.index('urls');
  const request = index.get(normalizedURLObject.href);
  const boundOnFindEntry = onFindEntry.bind(this, feed, entry, callback);
  request.onsuccess = boundOnFindEntry;
  request.onerror = boundOnFindEntry;
}

function onFindEntry(feed, entry, callback, event) {
  if(event.type !== 'success') {
    callback();
    return;
  }

  if(event.target.result) {
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
  // documents can be fetched, there is no point to doing so.
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
  // - i shouldn't be using the feed's favicon url, that is unrelated
  // - i should pass along the html of the associated html document. the
  // lookup should not fetch a second time.
  // - i should be querying against the redirect url

  const doc = event.document;
  transformLazyImages(doc);
  filterSourcelessImages(doc);
  filterInvalidAnchors(doc);
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

  // TODO: it looks like there is a bug where this is sometimes called twice
  // somehow. It only happens rarely. It isn't the worst case because the
  // db request just failed with a constraint error. But it is still wrong.
  // This should only be called once.
  // It could be that the entry is listed twice in the feed and I am
  // not properly removing dups somehow.
  // It could be that its http redirected to https, and then the dup occurs,
  // because I execute find_entry only against the most recent url
  // https://medium.com/@virgilgr/tors-branding-pivot-is-going-to-get-someone-
  // killed-6ee45313b559#.z1vs8xyjz
  // From the looks of it, it is because of the hash maybe
  // it could be that the whole feed is getting processed twice?
  //console.debug('Calling addEntry:', getEntryURL(entry));

  addEntry(this.connection, entry, callback);
}

function prepDoc(doc) {
  filterBoilerplate(doc);
  sanitizeDocument(doc);
  addNoReferrerToAnchors(doc);
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

function normalizeURL(url) {
  let clone = cloneURL(url);
  // Strip the hash
  clone.hash = '';
  return clone;
}

function cloneURL(url) {
  return new URL(url.href);
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
