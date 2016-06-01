// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

const FeedPoller = {};

FeedPoller.start = function() {
  console.log('Starting poll ...');

  // Check if we are online
  if('onLine' in navigator && !navigator.onLine) {
    console.debug('Polling canceled because offline');
    // TODO: still call onComplete despite early exit?
    return;
  }

  const ONLY_POLL_IF_IDLE = localStorage.ONLY_POLL_IF_IDLE;

  if(!ONLY_POLL_IF_IDLE) {
    // Skip the idle check and go straight to opening the database
    db.open(onOpenDatabase);
  } else {
    // Check if we have been idling for a minute
    const IDLE_PERIOD_SECONDS = 60;
    chrome.idle.queryState(IDLE_PERIOD_SECONDS, onQueryIdleState);
  }

  // TODO: these conditions can be simplified to eliminate the repetition of
  // the call to db.open
  function onQueryIdleState(state) {
    if(ONLY_POLL_IF_IDLE) {
      if(state === 'locked' || state === 'idle') {
        db.open(onOpenDatabase);
      } else {
        console.debug('Polling canceled because not idle');
        FeedPoller.onComplete();
      }
    } else {
      // Continue regardless of idle state
      db.open(onOpenDatabase);
    }
  }

  function onOpenDatabase(event) {
    // Exit early if there was a database connection error
    if(event.type !== 'success') {
      console.debug(event);
      FeedPoller.onComplete();
      return;
    }

    const connection = event.target.result;
    FeedPoller.iterateFeeds(connection);
  }
};

// Iterate over the feeds in the database, and update each feed.
// TODO: react appropriately to request error
FeedPoller.iterateFeeds = function(connection) {
  const iterateFeedsTransaction = connection.transaction('feed');
  const feedStore = iterateFeedsTransaction.objectStore('feed');
  const iterateFeedsRequest = feedStore.openCursor();
  const onSuccess = FeedPoller.onGetNextFeed.bind(iterateFeedsRequest,
    connection);
  iterateFeedsRequest.onsuccess = onSuccess;
};

// Processes the feed at the current cursor position and then advances the
// cursor.
FeedPoller.onGetNextFeed = function(connection, event) {
  const request = event.target;
  const cursor = request.result;

  if(cursor) {
    const feed = cursor.value;
    const timeout = 10 * 1000;
    const onFetchFeedBound = FeedPoller.onFetchFeed.bind(null, connection,
      feed);
    fetchFeed(feed.url, timeout, onFetchFeedBound);
    //FeedPoller.fetchFeed(connection, cursor.value);
    cursor.continue();
  } else {
    // No more feeds or no feeds found, so theoretically complete
    // TODO: this is calling onComplete too early. There are
    // misc additional async things that happen when processing a feed, and
    // technically it is only complete when each feed has been fully
    // processed, not just here where iteration has completed. So this is
    // wrong.
    // The problem is that cursor.continue is async above, and triggering
    // a separate request. I want that to happen because I want to process
    // feeds non-sequentially, concurrently, all at once. This will end up
    // getting called while some of those requests are still outstanding
    // or pending or whatever.

    // So how do I solve it? How does each feed handler know if it
    // the 'last' one if don't know the total number of feeds prior to this?
    // Maybe I just don't have an onComplete function for now?

    FeedPoller.onComplete();
  }
};

// TODO: rather than check if event is defined or not, check if event
// has the proper type (e.g. type === 'load') or whatever it is
// Right now, event is only defined if there was an error. In the future,
// I think event should always be defined, it is just that its type is
// 'load' or whatever for successful fetch.
// TODO: if I am always passing back event, I can probably get
// responseURL from the event itself, so I don't need to pass back
// responseURL as an explicit parameter, I can just use
// event.target.responseURL
// TODO: and it shouldn't be called errorEvent then, it should just be
// an event
// TODO: I am not even sure how much work fetchFeed should be doing on
// its own, implicitly. E.g. should it just be fetchXML and then all the
// post processing happens explicitly, here in the calling context?
// TODO: just a mental note, I am not yet using responseURL but I planned
// to use it. Something about how I should be detecting if the feed url is
// a redirect. I should only be using the post-redirect URL I think? But
// is that solved as subscribe time as opposed to here? Although any check
// for update means that after subscribe the source author could have
// added a redirect, so we always need to continue to check for it every
// time.

FeedPoller.onFetchFeed = function(connection, localFeed, errorEvent,
  remoteFeed, responseURL) {

  // Exit early if an error occurred while fetching. The event is only
  // defined if there was a fetch error.
  if(errorEvent) {
    console.debug('Error fetching:', localFeed.url);
    console.dir(errorEvent);
    return;
  }

  const onStoreFeedBound = FeedPoller.onStoreFeed.bind(null, connection,
    localFeed, remoteFeed);
  Feed.put(connection, localFeed, remoteFeed, onStoreFeedBound);
};

// TODO: stop using the async lib. Do custom async iteration here.
FeedPoller.onStoreFeed = function(connection, localFeed, remoteFeed, event) {

  // NOTE: we can ignore the event object because we know we are doing an
  // update, not an insert, and don't need new id from event.target.result, and
  // otherwise event does not contain anything useful except possibly it
  // may be type === 'error'?

  async.forEach(remoteFeed.entries,
    FeedPoller.findEntryByLink.bind(null, connection, feed),
    FeedPoller.onEntriesUpdated.bind(null, connection));

};

//FeedPoller.onEntriesUpdated = function(connection) {
  // Update the number of unread entries now that the number possibly changed
//  utils.updateBadgeText(connection);
//};

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
