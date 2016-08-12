// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

const poll = {};

// Obtain a poll lock by setting a flag in local storage. This uses local
// storage instead of global scope because the background page that calls out
// to poll.start occassionally unloads and reloads itself instead of remaining
// persistently open, which would reset the value of the global scope variable
// each page load. When polling determines if the poll is locked, it only
// checks for the presence of the key, and ignores the value, so the value I
// specify here is unimportant.
poll.acquireLock = function() {
  localStorage.POLL_IS_ACTIVE = 'true';
};

poll.releaseLock = function() {
  delete localStorage.POLL_IS_ACTIVE;
};

poll.isLocked = function() {
  return 'POLL_IS_ACTIVE' in localStorage;
}

// Checks for new feeds. If forceResetLock is true, then polling is allowed to
// continue even if it is locked (because poll is already running, or because
// poll finished incorrectly).
poll.start = function(forceResetLock) {
  console.log('Checking for new articles...');

  // Define a shared context for simple passing of shared state to continuations
  const context = {'pendingFeedsCount': 0, 'connection': null};

  if(forceResetLock) {
    poll.releaseLock();
  }

  if(poll.isLocked()) {
    console.warn('Cannot poll while another poll is running');
    poll.onComplete(context);
    return;
  }

  poll.acquireLock();

  if('onLine' in navigator && !navigator.onLine) {
    console.debug('Cannot poll while offline');
    poll.onComplete(context);
    return;
  }

  // Cancel the poll if on a metered connection and the no poll metered flag
  // is set. There currently is no way to set this flag in the UI, and
  // navigator.connection is still experimental.
  if('NO_POLL_METERED' in localStorage && navigator.connection &&
    navigator.connection.metered) {
    console.debug('Cannot poll on metered connection');
    poll.onComplete(context);
    return;
  }

  // Check if idle and possibly cancel the poll or continue with polling
  if('ONLY_POLL_IF_IDLE' in localStorage) {
    const idlePeriodInSeconds = 30;
    chrome.idle.queryState(idlePeriodInSeconds,
      poll.onQueryIdleState.bind(null, context));
  } else {
    Database.open(poll.onOpenDatabase.bind(null, context));
  }
};

poll.onQueryIdleState = function(context, state) {
  if(state === 'locked' || state === 'idle') {
    Database.open(poll.onOpenDatabase.bind(null, context));
  } else {
    console.debug('Polling canceled because not idle', state);
    poll.onComplete(context);
  }
};

poll.onOpenDatabase = function(context, connection) {
  if(connection) {
    // Cache the connection in the context for later use
    context.connection = connection;

    // Open a cursor over the feeds
    const transaction = connection.transaction('feed');
    const store = transaction.objectStore('feed');
    const request = store.openCursor();
    const onOpenFeedCursor = poll.onOpenFeedCursor.bind(null, context);
    request.onsuccess = onOpenFeedCursor;
    request.onerror = onOpenFeedCursor;
  } else {
    console.warn('Polling canceled because database connection error');
    poll.onComplete(context);
  }
};

poll.onOpenFeedCursor = function(context, event) {
  if(event.type !== 'success') {
    poll.onComplete(context);
    return;
  }

  const cursor = event.target.result;
  if(!cursor) {
    // Either no feeds exist or we finished iteration
    poll.onComplete(context);
    return;
  }

  // Bump the count to indicate a new feed is being polled
  context.pendingFeedsCount++;

  // Deserialize the object at the cursor's current position into a Feed object
  const feed = new Feed(cursor.value);

  // This assumes that the feed has a valid url, and should never throw
  const excludeEntries = false;
  const timeoutMillis = 10 * 1000;
  fetchFeed(feed.getURL(), timeoutMillis, excludeEntries,
    poll.onFetchFeed.bind(null, context, feed));

  // Advance the to next feed (async)
  cursor.continue();
};

poll.onFetchFeed = function(context, localFeed, event) {
  // If we failed to fetch the feed then we are done with the feed
  if(event.type !== 'load') {
    context.pendingFeedsCount--;
    poll.onComplete(context);
    return;
  }

  const remoteFeed = event.feed;

  // Check whether the feed has changed since last fetch
  if(localFeed.dateLastModified && remoteFeed.dateLastModified &&
    localFeed.dateLastModified.getTime() ===
    remoteFeed.dateLastModified.getTime()) {
    console.debug('Feed unmodified', localFeed.getURL().toString());
    context.pendingFeedsCount--;
    poll.onComplete(context);
    return;
  }

  // Revalidate the feed's favicon
  const queryURL = remoteFeed.link ? remoteFeed.link : remoteFeed.getURL();
  favicon.lookup(queryURL, null, poll.onLookupFeedFavicon.bind(null, context,
    localFeed, remoteFeed));
};

poll.onLookupFeedFavicon = function(context, localFeed, remoteFeed,
  faviconURL) {
  if(faviconURL) {
    remoteFeed.faviconURLString = faviconURL.href;
  }

  // Synchronize the feed loaded from the database with the fetched feed, and
  // then store the modified feed object in the database.
  const mergedFeed = localFeed.merge(remoteFeed);
  updateFeed(context.connection, mergedFeed,
    poll.onUpdateFeed.bind(null, context, remoteFeed.getEntries()));
};

poll.onUpdateFeed = function(context, entries, event) {


  // If something went wrong updating the feed then we are done
  if(event.type !== 'success') {
    context.pendingFeedsCount--;
    poll.onComplete(context);
    return;
  }

  // Now that the feed has been stored, start processing the feed's entries.
  // If there are no entries then we are finished with the feed. This check
  // avoids an NPE, and ensures we still callback when there are no entries.
  if(!entries || !entries.length) {
    context.pendingFeedsCount--;
    poll.onComplete(context);
    return;
  }

  // TODO: instead of passing along the feed, just shove it in feed context
  // and pass along context instead
  // or just pass along only the relevant fields needed like feedId and title
  // and faviconURLString

  // Create a subcontext for processing this feed's entries
  const feedContext = {
    'entriesProcessed': 0,
    'entriesAdded': 0,
    'numEntries': entries.length
  };

  const boundOnEntryProcessed = poll.onEntryProcessed.bind(null, context,
    feedContext);
  for(let entry of entries) {
    poll.processEntry(context, event.feed, entry, boundOnEntryProcessed);
  }
};

poll.processEntry = function(context, feed, entry, callback) {
  // Verify the entry has a url
  if(!entry.hasURL()) {
    console.warn('Entry missing url', entry);
    callback();
    return;
  }

  // Rewrite the url
  const rewrittenURL = rewriteURL(entry.getURL());
  entry.addURL(rewrittenURL);

  // Check whether an entry with the same url exists
  const transaction = context.connection.transaction('entry');
  const store = transaction.objectStore('entry');
  const index = store.index('urls');
  const request = index.get(entry.getURL().href);
  const onFind = poll.onFindEntryByURL.bind(null, context, feed, entry,
    callback);
  request.onsuccess = onFind;
  request.onerror = onFind;
};



poll.onFindEntryByURL = function(context, feed, entry, callback, event) {
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

  // Check that the url does not belong to a domain that obfuscates its content
  // with things like advertisement interception or full javascript. While these
  // documents can be fetched, there is no point to doing so.
  if(poll.isFetchResistantURL(entry.getURL())) {
    addEntry(context.connection, entry, callback);
    return;
  }

  // Check if the entry url does not point to a PDF. This limits the amount of
  // networking in the general case, even though the extension isn't a real
  // indication of the mime type and may have some false positives. Even if
  // this misses it, responseXML will be undefined in fetchHTML so false
  // negatives are not too important.
  const path = entry.getURL().pathname;
  const minLen = '/a.pdf'.length;
  if(path && path.length > minLen && /\.pdf$/i.test(path)) {
    addEntry(context.connection, entry, callback);
    return;
  }

  // Fetch the entry's webpage
  const timeoutMillis = 10 * 1000;
  fetchHTML(entry.getURL(), timeoutMillis,
    poll.onFetchEntry.bind(null, context, entry, callback));
};

poll.onFetchEntry = function(context, entry, callback, event) {

  if(event.type !== 'success') {
    addEntry(context.connection, entry, callback);
    return;
  }

  // Add the redirect url
  entry.addURL(event.responseURL);

  // TODO: if we successfully fetched the entry, then before storing it,
  // we should be trying to set its faviconURL.
  // - i shouldn't be using the feed's favicon url, that is unrelated
  // - i should pass along the html of the associated html document. the
  // lookup should not fetch a second time.
  // - i should be querying against the redirect url



  // Prep the document
  const document = event.document;
  transformLazyImages(document);
  filterSourcelessImages(document);
  resolveDocumentURLs(document, event.responseURL);
  filterTrackingImages(document);
  setImageDimensions(document,
    poll.onSetImageDimensions.bind(null, context, entry, document, callback));
};

poll.onSetImageDimensions = function(context, entry, document, callback,
  numImagesModified) {

  // Replace the entry's content with the full html of the modified document
  const content = document.documentElement.outerHTML.trim();
  if(content) {
    entry.content = content;
  }

  addEntry(context.connection, entry, callback);
};

poll.onEntryProcessed = function(pollContext, feedContext, event) {
  feedContext.entriesProcessed++;
  // If called as a result of addEntry then an event will be available
  if(event && event.type === 'success') {
    feedContext.entriesAdded++;
  }

  console.assert(feedContext.entriesProcessed <= feedContext.numEntries,
    'entriesProcessed greater than numEntries', feedContext.entriesProcessed,
    feedContext.numEntries);

  // We are finished processing the feed if we finished processing its entries
  if(feedContext.entriesProcessed === feedContext.numEntries) {
    // Only update the badge if we actually added some entries
    if(feedContext.entriesAdded) {
      badge.update(pollContext.connection);
    }

    pollContext.pendingFeedsCount--;
    poll.onComplete(pollContext);
  }
};

poll.onComplete = function(context) {

  // onComplete is called whenever a feed finishes processing, or when there
  // were no feeds to process. Feeds are processed concurrently. Each time a
  // feed starts processing, pendingFeedsCount is incremented. Each time a feed
  // finishes processing, pendingFeedsCount is decremented.
  // Check if there are still these outstanding feeds and do not actually
  // complete the poll in that case.

  if(context.pendingFeedsCount) {
    return;
  }

  notify('Updated articles', 'Completed checking for new articles');

  // connection may be undefined when the poll failed to connect and called
  // onComplete
  if(context.connection) {
    context.connection.close();
  }

  poll.releaseLock();

  // Calls to badge.update may still be pending so this message might appear out
  // of order in the console.
  console.log('Polling completed');
};

poll.isFetchResistantURL = function(url) {
  console.assert(url && url.hostname, 'invalid url', url);
  const blacklist = [
    'productforums.google.com',
    'groups.google.com',
    'www.forbes.com',
    'forbes.com'
  ];

  // hostname getter normalizes url part to lowercase
  return blacklist.includes(url.hostname);
};
