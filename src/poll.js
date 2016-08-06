// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

// Checks for new feeds. If forceResetLock is true, then polling is allowed to
// continue even if it is locked (because poll is already running, or because
// poll finished incorrectly).
function poll(forceResetLock) {
  console.log('Checking for new articles...');

  // Define a shared context for simple passing of shared state to continuations
  const context = {
    'pendingFeedsCount': 0,
    'connection': null
  };

  // If not forcing a reset of the lock, then check whether the poll is locked
  // and if so then cancel.
  if(!forceResetLock && 'POLL_IS_ACTIVE' in localStorage) {
    console.warn('Cannot poll while another poll is running');
    pollOnComplete(context);
  }

  // Lock the poll. The value is not important, just the key's presence.
  // The lock is external because it is not unique to the current execution
  localStorage.POLL_IS_ACTIVE = 'true';

  // Cancel the poll if offline
  if('onLine' in navigator && !navigator.onLine) {
    console.debug('Cannot poll while offline');
    pollOnComplete(context);
    return;
  }

  // Cancel the poll if on a metered connection and the no poll metered flag
  // is set. There currently is no way to set this flag in the UI, and
  // navigator.connection is still experimental.
  if('NO_POLL_METERED' in localStorage && navigator.connection &&
    navigator.connection.metered) {
    console.debug('Cannot poll on metered connection');
    pollOnComplete(context);
    return;
  }

  // Check if idle and possibly cancel the poll or continue with polling
  if('ONLY_POLL_IF_IDLE' in localStorage) {
    const idlePeriodInSeconds = 30;
    chrome.idle.queryState(idlePeriodInSeconds,
      pollOnQueryIdleState.bind(null, context));
  } else {
    openIndexedDB(pollOnOpenDatabase.bind(null, context));
  }
}

function pollOnQueryIdleState(context, state) {
  if(state === 'locked' || state === 'idle') {
    openIndexedDB(pollOnOpenDatabase.bind(null, context));
  } else {
    console.debug('Polling canceled because not idle', state);
    pollOnComplete(context);
  }
}

function pollOnOpenDatabase(context, connection) {
  if(connection) {
    // Cache the connection in the context for later use
    context.connection = connection;

    // Open a cursor over the feeds
    const transaction = connection.transaction('feed');
    const store = transaction.objectStore('feed');
    const request = store.openCursor();
    const onOpenFeedCursor = pollOnOpenFeedCursor.bind(null, context);
    request.onsuccess = onOpenFeedCursor;
    request.onerror = onOpenFeedCursor;
  } else {
    console.warn('Polling canceled because database connection error');
    pollOnComplete(context);
  }
}

function pollOnOpenFeedCursor(context, event) {
  if(event.type !== 'success') {
    pollOnComplete(context);
    return;
  }

  const cursor = event.target.result;
  if(!cursor) {
    // Either no feeds exist or we finished iteration
    pollOnComplete(context);
    return;
  }

  // Bump the count to indicate a new feed is being polled
  context.pendingFeedsCount++;

  // Fetch the feed
  const feed = cursor.value;

  // This assumea that the feed has a valid url, and should never throw
  const requestURL = new URL(Feed.prototype.getURL.call(feed));
  const excludeEntries = false;
  const timeoutMillis = 10 * 1000;
  fetchFeed(requestURL, timeoutMillis, excludeEntries,
    pollOnFetchFeed.bind(null, context, feed));

  // Advance the to next feed (async)
  cursor.continue();
}

function pollOnFetchFeed(context, localFeed, event) {
  // If we failed to fetch the feed then we are done with the feed
  if(event.type !== 'load') {
    context.pendingFeedsCount--;
    pollOnComplete(context);
    return;
  }

  const remoteFeed = event.feed;

  // Check whether the feed has changed since last fetch
  if(localFeed.dateLastModified && remoteFeed.dateLastModified &&
    localFeed.dateLastModified.getTime() ===
    remoteFeed.dateLastModified.getTime()) {
    // console.debug('Feed unmodified', Feed.prototype.getURL.call(localFeed));
    context.pendingFeedsCount--;
    pollOnComplete(context);
    return;
  }

  // Revalidate the feed's favicon. Try and use the url of the associated
  // website first, then fallback to the url of the xml file.
  // lookupFavicon expects a URL object. fetchFeed produces a feed-like object
  // containing URL objects, so we do not need to parse strings into URLs.
  const onLookup = pollOnLookupFeedFavicon.bind(null, context, localFeed,
    remoteFeed);
  const queryURL = remoteFeed.link ? remoteFeed.link :
    Feed.prototype.getURL.call(remoteFeed);
  lookupFavicon(queryURL, null, onLookup);
}

function pollOnLookupFeedFavicon(context, localFeed, remoteFeed, faviconURL) {
  if(faviconURL) {
    remoteFeed.faviconURLString = faviconURL.href;
  }

  // Synchronize the feed loaded from the database with the fetched feed, and
  // then store the new feed in the database.
  // Merge requires that both feeds be serialized. localFeed already is because
  // it was loaded from the database, but the remote feed is not because
  // parseFeed produces a feed-like object with things like URL objects
  const mergedFeed = Feed.prototype.merge.call(localFeed,
    Feed.prototype.serialize.call(remoteFeed));
  updateFeed(context.connection, mergedFeed,
    pollOnUpdateFeed.bind(null, context, remoteFeed.entries));
}

function pollOnUpdateFeed(context, entries, resultType, feed) {
  // If something went wrong updating the feed then we are done
  if(resultType !== 'success') {
    context.pendingFeedsCount--;
    pollOnComplete(context);
    return;
  }

  // Now that the feed has been stored, start processing the feed's entries.
  // If there are no entries then we are finished with the feed.
  if(!entries.length) {
    context.pendingFeedsCount--;
    pollOnComplete(context);
    return;
  }

  // Create a subcontext for processing this feed's entries
  const feedContext = {
    'entriesProcessed': 0,
    'entriesAdded': 0,
    'numEntries': entries.length
  };

  const boundOnEntryProcessed = pollOnEntryProcessed.bind(null, context,
    feedContext);
  for(let entry of entries) {
    pollProcessEntry(context, feed, entry, boundOnEntryProcessed);
  }
}

function pollOnEntryProcessed(pollContext, feedContext, optionalAddEntryEvent) {
  feedContext.entriesProcessed++;

  if(optionalAddEntryEvent && optionalAddEntryEvent.type === 'success') {
    feedContext.entriesAdded++;
  }

  // We are finished processing the feed if we finished processing its entries
  if(feedContext.entriesProcessed === feedContext.numEntries) {
    // Only update the badge if we actually added some entries
    if(feedContext.entriesAdded) {
      updateBadgeUnreadCount(pollContext.connection);
    }

    pollContext.pendingFeedsCount--;
    pollOnComplete(pollContext);
  }
}

function pollProcessEntry(context, feed, entry, callback) {
  // Verify the entry has a url
  if(!Entry.prototype.hasURL.call(entry)) {
    console.warn('Entry missing url', entry);
    callback();
    return;
  }

  // Rewrite the url
  Entry.prototype.addURL.call(entry,
    rewriteURL(Entry.prototype.getURL.call(entry)));

  // Check whether an entry with the same url exists
  const transaction = context.connection.transaction('entry');
  const store = transaction.objectStore('entry');
  const index = store.index('urls');
  const keyPath = Entry.prototype.getURL.call(entry).href;
  const request = index.get(keyPath);
  const onFind = pollOnFindEntryWithURL.bind(null, context, feed, entry,
    callback);
  request.onsuccess = onFind;
  request.onerror = onFind;
}

function pollOnFindEntryWithURL(context, feed, entry, callback, event) {
  // If there was an error searching for the entry by url, then consider the
  // find successful and we are finished processing the entry
  if(event.type !== 'success') {
    callback();
    return;
  }

  // If we found a matching entry then we are finished
  if(event.target.result) {
    callback();
    return;
  }

  // The entry doesn't exist, so we plan to store it.
  // Link the entry to its feed
  entry.feed = feed.id;

  // Propagate the feed's favicon to the entry
  if(feed.faviconURLString) {
    entry.faviconURLString = feed.faviconURLString;
  }

  // Propagate the feed's title to the entry. This denormalization avoids
  // the need to query for the feed's title when displaying the entry. The
  // catch is that if a feed's title later changes, the change is not
  // reflected in entry's previously stored.
  // There is no sanitization concern here, because feed.title was sanitized
  // earlier when updating the feed
  if(feed.title) {
    entry.feedTitle = feed.title;
  }

  // The next step is to try and fetch the full html of the entry and use that
  // as its content in place of the original content.
  const entryURL = Entry.prototype.getURL.call(entry);

  // Check that the url does not belong to a domain that obfuscates its content
  // with things like advertisement interception or full javascript. While these
  // documents can be fetched, there is no point to doing so.
  if(pollIsFetchResistantURL(entryURL)) {
    addEntry(context.connection, entry, callback);
    return;
  }

  // Check if the entry url does not point to a PDF. This limits the amount of
  // networking in the general case, even though the extension isn't a real
  // indication of the mime type and may have some false positives. Even if
  // this misses it, responseXML will be undefined in fetchHTML so false
  // negatives are not too important.
  const path = entryURL.pathname;
  const minLen = '/a.pdf'.length;
  if(path && path.length > minLen && /\.pdf$/i.test(path)) {
    addEntry(context.connection, entry, callback);
    return;
  }

  // Fetch the entry's webpage

  const timeoutMillis = 10 * 1000;
  fetchHTML(entryURL, timeoutMillis,
    pollOnFetchEntryDocument.bind(null, context, entry, callback));
}

function pollOnFetchEntryDocument(context, entry, callback, event) {

  if(event.type !== 'success') {
    addEntry(context.connection, entry, callback);
    return;
  }

  // We successfully fetched the full text
  // Add the redirect url
  Entry.prototype.addURL.call(entry, event.responseURL);

  // Prep the document
  const document = event.document;
  transformLazyImages(document);
  filterSourcelessImages(document);
  resolveDocumentURLs(document, event.responseURL);
  filterTrackingImages(document);
  setImageDimensions(document,
    pollOnSetImageDimensions.bind(null, context, entry, document, callback));
}

function pollOnSetImageDimensions(context, entry, document, callback,
  numImagesModified) {

  // Replace the entry's content with the full html of the modified document
  const content = document.documentElement.outerHTML.trim();
  if(content) {
    entry.content = content;
  }

  addEntry(context.connection, entry, callback);
}

function pollOnComplete(context) {
  // Every time a feed completes it calls pollOnComplete. However, multiple
  // feeds are processed concurrently and calls pollOnComplete out of order.
  // Each time a feed completes it deprecates the pendingFeedsCount. This means
  // that if pendingFeedsCount is > 0 here, the poll is ongoing.
  if(context.pendingFeedsCount) {
    return;
  }

  // Show a notification
  if('SHOW_NOTIFICATIONS' in localStorage) {
    const notification = {
      'type': 'basic',
      'title': chrome.runtime.getManifest().name,
      'iconUrl': '/images/rss_icon_trans.gif',
      'message': 'Updated articles'
    };
    chrome.notifications.create('Lucubrate', notification, function() {});
  }

  // Close out the connection
  if(context.connection) {
    context.connection.close();
  }

  // Unlock so that the poll can run again
  delete localStorage.POLL_IS_ACTIVE;

  console.log('Polling completed');
}

function pollIsFetchResistantURL(url) {
  console.assert(url && url.hostname, 'invalid url', url);
  const blacklist = [
    'productforums.google.com',
    'groups.google.com',
    'www.forbes.com',
    'forbes.com'
  ];

  // hostname getter normalizes url part to lowercase
  return blacklist.includes(url.hostname);
}
