// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

class PollingService {

constructor() {
  this.idlePeriodInSeconds = 30;
  this.faviconService = new FaviconService();
  this.fetchFeedService = new FeedHttpService();
  this.fetchFeedService.timeoutMillis = 10 * 1000;
  this.fetchHTMLService = new FetchHTMLService();
  this.fetchHTMLService.timeoutMillis = 10 * 1000;
}

// Starts the polling process
start() {
  console.group('Checking for new articles...');

  const context = {
    'pendingFeedsCount': 0,
    'connection': null
  };

  if(PollingService.isOffline()) {
    console.debug('Cannot poll while offline');
    this.onMaybePollCompleted(context);
    return;
  }

  if(PollingService.isMeteredConnection()) {
    console.debug('Cannot poll on metered connection');
    this.onMaybePollCompleted(context);
    return;
  }

  if('ONLY_POLL_IF_IDLE' in localStorage) {
    chrome.idle.queryState(this.idlePeriodInSeconds,
      this.onQueryIdleState.bind(this, context));
  } else {
    // Skip the idle check and continue
    openIndexedDB(this.onOpenDatabase.bind(this, context));
  }
}

static isOffline() {
  return navigator && 'onLine' in navigator && !navigator.onLine;
}

static isMeteredConnection() {
  return navigator && 'connection' in navigator &&
    'NO_POLL_METERED' in localStorage && navigator.connection &&
    navigator.connection.metered;
}

onQueryIdleState(context, idleState) {
  if(idleState === 'locked' || idleState === 'idle') {
    openIndexedDB(this.onOpenDatabase.bind(this, context));
  } else {
    console.debug('Polling canceled because not idle');
    this.onMaybePollCompleted(context);
  }
}

onOpenDatabase(context, connection) {
  if(connection) {
    context.connection = connection;
    const transaction = connection.transaction('feed');
    const store = transaction.objectStore('feed');
    const request = store.openCursor();
    request.onsuccess = this.onOpenFeedsCursor.bind(this, context);
    request.onerror = this.onOpenFeedsCursor.bind(this, context);
  } else {
    console.debug('Polling canceled because database connection error');
    this.onMaybePollCompleted(context);
  }
}

onOpenFeedsCursor(context, event) {
  if(event.type !== 'success') {
    this.onMaybePollCompleted(context);
    return;
  }

  const cursor = event.target.result;
  if(!cursor) {
    // Either no feeds exist or we finished iteration
    this.onMaybePollCompleted(context);
    return;
  }

  context.pendingFeedsCount++;
  const feed = cursor.value;
  const requestURL = new URL(Feed.prototype.getURL.call(feed));
  const excludeEntries = false;
  this.fetchFeedService.fetch(requestURL, excludeEntries,
    this.onFetchFeed.bind(this, context, feed));
  cursor.continue();
}

onFetchFeed(context, localFeed, fetchEvent) {
  if(fetchEvent.type !== 'load') {
    context.pendingFeedsCount--;
    this.onMaybePollCompleted(context);
    return;
  }

  const remoteFeed = fetchEvent.feed;

  // Check whether the feed has changed since last fetch
  if(localFeed.dateLastModified && remoteFeed.dateLastModified &&
    localFeed.dateLastModified.getTime() ===
    remoteFeed.dateLastModified.getTime()) {
    console.debug('Feed unmodified', Feed.prototype.getURL.call(localFeed));
    context.pendingFeedsCount--;
    this.onMaybePollCompleted(context);
    return;
  }

  // Refresh the feed's favicon.
  if(remoteFeed.link) {
    this.faviconService.lookup(remoteFeed.link, null,
      this.onLookupFeedFavicon.bind(this, context, localFeed, remoteFeed));
  } else {
    this.faviconService.lookup(Feed.prototype.getURL.call(remoteFeed),
      fetchEvent.responseXML,
      this.onLookupFeedFavicon.bind(this, context, localFeed, remoteFeed));
  }
}

onLookupFeedFavicon(context, localFeed, remoteFeed, faviconURL) {
  if(faviconURL) {
    remoteFeed.faviconURLString = faviconURL.href;
  }

  // Synchronize the feed loaded from the database with the fetched feed, and
  // then store the new feed in the database.
  const mergedFeed = Feed.prototype.merge.call(localFeed,
    Feed.prototype.serialize.call(remoteFeed));
  updateFeed(context.connection, mergedFeed,
    this.onUpdateFeed.bind(this, context, remoteFeed.entries));
}

onUpdateFeed(context, entries, resultType, feed) {
  if(resultType !== 'success') {
    context.pendingFeedsCount--;
    this.onMaybePollCompleted(context);
    return;
  }

  // Now that the feed has been stored, start processing the feed's entries.
  // If there are no entries then we are finished processing the feed.
  if(!entries.length) {
    context.pendingFeedsCount--;
    this.onMaybePollCompleted(context);
    return;
  }

  let entriesProcessed = 0;
  let entriesAdded = 0;
  const boundOnEntryProcessed = onEntryProcessed.bind(this);
  for(let entry of entries) {
    this.processEntry(context, feed, entry, boundOnEntryProcessed);
  }

  function onEntryProcessed(optionalAddEntryEvent) {
    entriesProcessed++;

    if(optionalAddEntryEvent && optionalAddEntryEvent.type === 'success') {
      entriesAdded++;
    }

    if(entriesProcessed === entries.length) {
      if(entriesAdded) {
        updateBadgeUnreadCount();
      }

      context.pendingFeedsCount--;
      this.onMaybePollCompleted(context);
    }
  }
}

processEntry(context, feed, entry, callback) {

  let entryURL = Entry.prototype.getURL.call(entry);

  console.assert(entryURL, 'invalid url for entry %O', entry);

  // Verify the entry has a url
  // TODO: this should just be an assert because entries without urls should
  // already have been filtered. Or maybe not? Whose responsibility is it to
  // impose the url requirement?
  if(!entryURL) {
    console.warn('Entry missing url', entry);
    callback();
    return;
  }

  // Append the rewritten url if rewriting occurred
  const rewrittenURL = PollingService.rewriteURL(entryURL);
  if(rewrittenURL.href !== entryURL.href) {
    entry.urls.push(rewrittenURL);

    // Update entryURL to point to the terminal url in the chain
    entryURL = rewrittenURL;
  }

  // Check whether an entry with the same url exists
  const transaction = context.connection.transaction('entry');
  const entryStore = transaction.objectStore('entry');
  const urlsIndex = entryStore.index('urls');
  const request = urlsIndex.get(entryURL.href);
  request.onsuccess = onFindEntryWithURL.bind(this);
  request.onerror = onFindEntryWithURL.bind(this);

  const boundOnFetchEntryDocument = onFetchEntryDocument.bind(this);

  function onFindEntryWithURL(event) {
    // If there was a problem searching for the entry by url, then consider the
    // entry as existing and we are finished processing the entry
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

    // Propagate the feed's title to the entry
    if(feed.title) {
      entry.feedTitle = feed.title;
    }

    // Try and fetch the entry's webpage
    this.fetchHTMLService.fetch(entryURL, boundOnFetchEntryDocument);
  }

  function onFetchEntryDocument(event) {

    if(event.type === 'success') {
      if(event.responseURL.href !== entryURL.href) {
        entry.urls.push(event.responseURL);
      }

      const document = event.responseXML;
      const contentString = document.documentElement.outerHTML.trim();
      if(contentString) {
        entry.content = contentString;
      }
    }

    addEntry(context.connection, entry, callback);
  }
}

onMaybePollCompleted(context) {
  if(context.pendingFeedsCount) {
    return;
  }

  if('SHOW_NOTIFICATIONS' in localStorage) {
    this.showPollCompletedNotification();
  }

  if(context.connection) {
    context.connection.close();
  }

  console.log('Polling completed');
  console.groupEnd();
}

showPollCompletedNotification() {
  const notification = {
    'type': 'basic',
    'title': chrome.runtime.getManifest().name,
    'iconUrl': '/images/rss_icon_trans.gif',
    'message': 'Updated articles'
  };
  chrome.notifications.create('Lucubrate', notification, function() {});
}

// Applies a set of rules to a url object and returns a modified url object
// Currently this only modifies Google News urls, but I plan to include more
// TODO: instead of a regular expression I could consider using the new
// URL api to access and test against components of the URL
static rewriteURL(inputURL) {
  let outputURL = new URL(inputURL.href);
  const GOOGLE_NEWS = /^https?:\/\/news.google.com\/news\/url\?.*url=(.*)/i;
  const matches = GOOGLE_NEWS.exec(inputURL.href);
  if(matches && matches.length === 2 && matches[1]) {
    const param = decodeURIComponent(matches[1]);
    try {
      outputURL = new URL(param);
      // console.debug('Rewrote', inputURL.href, 'as', outputURL.href);
    } catch(exception) {
      console.warn('Error rewriting url', exception);
    }
  }

  return outputURL;
}

}
