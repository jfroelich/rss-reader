// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

const FeedPoller = {};

FeedPoller.start = function() {
  console.log('Starting poll ...');

  if(!FeedPoller.isOnline()) {
    console.debug('Polling canceled because offline');
    return;
  }

  chrome.permissions.contains({permissions: ['idle']},
    FeedPoller.onCheckIdlePermission);
};

FeedPoller.isOnline = function() {
  if(!navigator) {
    return true;
  }

  if(!navigator.hasOwnProperty('onLine')) {
    return true;
  }

  return navigator.onLine;
};

FeedPoller.onCheckIdlePermission = function(permitted) {
  const IDLE_PERIOD_IN_SECONDS = 60 * 5; // 5 minutes

  // TODO: I no longer like how I dynamically set the permission. The
  // permission should always be set in manifest.json, and instead I should
  // just be checking a localStorage property. The options UI should just be
  // modifying that property. This will also make this step more sync, because
  // I can skip jumping through the queryState hoop

  // If we are permitted to check idle state, then check it. Otherwise,
  // immediately continue to polling.
  if(permitted) {
    chrome.idle.queryState(IDLE_PERIOD_IN_SECONDS,
      FeedPoller.onQueryIdleState);
  } else {
    db.open(FeedPoller.iterateFeeds);
  }
};

FeedPoller.onQueryIdleState = function(state) {
  if(state === 'locked' || state === 'idle') {
    // If we appear to be idle then start polling
    db.open(FeedPoller.iterateFeeds);
  } else {
    // We are not idle, so end polling
    console.debug('Polling canceled because not idle');
    FeedPoller.onComplete();
  }
};

// Iterate over the feeds in the database, and update each feed.
FeedPoller.iterateFeeds = function(event) {
  // Exit early if there was a database connection error
  if(event.type !== 'success') {
    console.debug(event);
    FeedPoller.onComplete();
    return;
  }

  // TODO: rather than delegate iteration to the database, i would prefer to
  // control iteration here. However, we can still delegate the generation
  // of the cursor request to an external db function


  const connection = event.target.result;
  const boundFetchFeed = FeedPoller.fetchFeed.bind(null, connection);
  Feed.forEach(connection, boundFetchFeed, false, FeedPoller.onComplete);
};

FeedPoller.fetchFeed = function(connection, feed) {
  const timeout = 10 * 1000;
  const onFetchFeedBound = FeedPoller.onFetchFeed.bind(null, connection, feed);
  fetchFeed(feed.url, timeout, onFetchFeedBound);
};

FeedPoller.onFetchFeed = function(connection, feed, event, remoteFeed) {
  // Exit early if an error occurred while fetching. This does not
  // continue processing the feed or its entries. The event is only defined
  // if there was a fetch error.
  // TODO: rather than check if event is defined or not, check if event
  // has the proper type (e.g. type === 'load') or whatever it is
  if(event) {
    console.debug('Error fetching:', feed.url);
    console.dir(event);
    return;
  }

  // TODO: if we are cleaning up the properties in Feed.put,
  // are we properly cascading those cleaned properties to the entries?
  // is there any sanitization there that would need to be propagated?
  // maybe sanitization isn't a function of storage, and storage just
  // stores, and so this should be calling sanitize_before_store or
  // something to that effect that prepares a feed object for storage. in
  // fact that function creates a new storable object
  // TODO: also, it still is really unclear which feed is which, what is
  // feed and what is remoteFeed? How much of the original feed do I need?

  const onStoreFeedBound = FeedPoller.onStoreFeed.bind(null, connection, feed,
    remoteFeed);
  Feed.put(connection, feed, remoteFeed, onStoreFeedBound);
};

// TODO: what's with the _?
FeedPoller.onStoreFeed = function(connection, feed, remoteFeed, _) {
  // TODO: stop using the async lib. Do custom async iteration here.
  async.forEach(remoteFeed.entries,
    FeedPoller.findEntryByLink.bind(null, connection, feed),
    FeedPoller.onEntriesUpdated.bind(null, connection));
};

FeedPoller.onEntriesUpdated = function(connection) {
  // Update the number of unread entries now that the number possibly changed
  // Pass along the current connection so that utils.updateBadgeText does not
  // have to create a new one.
  utils.updateBadgeText(connection);
};

// For an entry in the feed, check whether an entry with the same link
// already exists.
FeedPoller.findEntryByLink = function(connection, feed, entry, callback) {
  const transaction = connection.transaction('entry');
  const entries = transaction.objectStore('entry');
  const links = entries.index('link');
  const request = links.get(entry.link);

  const onFindEntryBound = FeedPoller.onFindEntry.bind(null, connection, feed,
    entry, callback);
  request.onsuccess = onFindEntryBound;
};

// If an existing entry was found, then exit early (callback with no args to
// async.forEach which means continue to the next entry). Otherwise, the entry
// doesn't exist. Get the full html of the entry. Update the properties of the
// entry. Then store the entry, and then callback to async.forEach.
FeedPoller.onFindEntry = function(connection, feed, entry, callback, event) {
  const getEntryRequest = event.target;
  const localEntry = getEntryRequest.result;

  if(localEntry) {
    callback();
  } else {
    const timeout = 20 * 1000;
    FeedPoller.augmentEntryContent(entry, timeout, onAugment);
  }

  function onAugment(event) {
    FeedPoller.cascadeFeedProperties(feed, entry);
    Entry.put(connection, entry, callback);
  }
};

// Copy some properties from feed into entry prior to storage
FeedPoller.cascadeFeedProperties = function(feed, entry) {
  entry.feed = feed.id;

  // Denormalize now to avoid doing the lookup on render
  entry.feedLink = feed.link;
  entry.feedTitle = feed.title;

  // Use the feed's date for undated entries
  if(!entry.pubdate && feed.date) {
    entry.pubdate = feed.date;
  }
};

// The entire poll completed
FeedPoller.onComplete = function() {
  console.log('Polling completed');
  localStorage.LAST_POLL_DATE_MS = '' +Date.now();
  utils.showNotification('Updated articles');
};

// TODO: move this into a separate lib?
// Fetch the full content for the entry
FeedPoller.augmentEntryContent = function(entry, timeout, callback) {
  const onFetchHTMLBound = FeedPoller.onFetchHTML.bind(null, entry, callback);
  FeedPoller.fetchHTML(entry.link, timeout, onFetchHTMLBound);
};

// TODO: what is the default behavior of XMLHttpRequest? If responseType
// defaults to document and by default fetches HTML, do we even need to
// specify the type?
// TODO: instead of creating an error object when document is undefined, maybe
// this should create an event object so that it is minimally consistent with
// the other types of the first argument when the callback is called due to
// another type of error. I could use a plain javascript object with just the
// desired relevant properties, or I could research how to create custom
// events.
FeedPoller.fetchHTML = function(url, timeout, callback) {
  const request = new XMLHttpRequest();
  request.timeout = timeout;
  request.ontimeout = onTimeout;
  request.onerror = onError;
  request.onabort = onAbort;
  request.onload = onLoad;
  request.open('GET', url, true);
  request.responseType = 'document';
  request.send();

  function onLoad(event) {
    let error = null;
    const document = request.responseXML;
    if(!document) {
      error = new Error('Undefined document for url ' + url);
    } else if(!document.documentElement) {
      error = new Error('Undefined document element for url ' + url);
    }
    callback(error, document, request.responseURL);
  }

  function onTimeout(event) {
    callback(event, null, request.responseURL);
  }

  function onError(event) {
    callback(event, null, request.responseURL);
  }

  function onAbort(event) {
    callback(event, null, request.responseURL);
  }
};

// If an error occurred when fetching the full html, exit early with a no-args
// callback to signal to async.forEach to continue to the next entry.
// Otherwise, clean up the html. Remove urls, set image sizes, resolve urls.
FeedPoller.onFetchHTML = function(entry, callback, error, document,
  responseURL) {
  if(error) {
    // This error happens when doing things like trying to fetch a PDF
    // document, the document is undefined. For now I am disabling this
    // error message until I focus on this particular feature.
    // console.debug(error);
    callback();
    return;
  }

  // TODO: eventually do something with this?
  if(responseURL !== entry.link) {
    // NOTE: tentatively I am not logging this while I work on other things
    // because it floods the log. But note that this definitely happens,
    // the responseURL is sometimes different than entry.link
    //console.debug('Response URL changed from %s to %s', entry.link,
    //  responseURL);
  }

  ImageUtils.filterTrackingImages(document);
  ImageUtils.transformLazilyLoadedImages(document);
  URLResolver.resolveURLsInDocument(document, responseURL);
  const onSetDimensions = FeedPoller.onSetImageDimensions.bind(null, entry,
    document, callback);
  ImageUtils.fetchDimensions(document, onSetDimensions);
};

// Upon setting the sizes of images, replace the content property of the entry,
// and then callback without arguments to signal to async.forEach to continue.
FeedPoller.onSetImageDimensions = function(entry, document, callback) {
  const documentElement = document.documentElement;
  if(documentElement) {
    const fullDocumentHTMLString = documentElement.outerHTML;
    if(fullDocumentHTMLString) {
      // Check for content length. This should reduce the number of empty
      // articles.
      // TODO: maybe I should be checking the content of body. In fact if
      // there is no body element, maybe this shouldn't even be replacing
      // entry.content at all. Maybe documentElement is the wrong thing
      // to consider. Maybe I want to check body but use the full content
      // of documentElement.
      // Also, maybe I want to use an substitute message.
      const trimmedString = fullDocumentHTMLString.trim();
      if(trimmedString) {
        entry.content = fullDocumentHTMLString;
      }
    }
  }

  callback();
};
