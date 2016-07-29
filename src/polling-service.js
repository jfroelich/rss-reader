// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

class PollingService {

constructor() {
  this.idlePeriodInSeconds = 30;
  this.feedCache = new FeedCache();
  this.faviconService = new FaviconService();
  this.badgeUpdateService = new BadgeUpdateService();
  this.fetchFeedService = new FeedHttpService();
  this.fetchFeedService.timeoutMillis = 10 * 1000;
  this.urlRewritingService = new URLRewritingService();
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
    this.feedCache.open(this.onOpenDatabase.bind(this, context));
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
    this.feedCache.open(this.onOpenDatabase.bind(this, context));
  } else {
    console.debug('Polling canceled because not idle');
    this.onMaybePollCompleted(context);
  }
}

onOpenDatabase(context, connection) {
  if(connection) {
    context.connection = connection;
    this.feedCache.openFeedsCursor(connection,
      this.onOpenFeedsCursor.bind(this, context));
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
  this.feedCache.updateFeed(context.connection, mergedFeed,
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
        this.badgeUpdateService.updateCount();
      }

      context.pendingFeedsCount--;
      this.onMaybePollCompleted(context);
    }
  }
}

processEntry(context, feed, entry, callback) {
  // Verify the entry has a url
  // TODO: this should just be an assert because entries without urls should
  // already have been filtered. Or maybe not? Whose responsibility is it to
  // impose the url requirement?
  if(!Entry.prototype.hasURL.call(entry)) {
    console.warn('Entry missing url', entry);
    callback();
    return;
  }

  const entryURL = Entry.prototype.getURL.call(entry);

  // Append the rewritten url if rewriting occurred
  const rewrittenURL = this.urlRewritingService.rewriteURL(entryURL);
  if(rewrittenURL.href !== entryURL.href) {
    entry.urls.push(rewrittenURL);
  }

  // Check whether an entry with the same url exists
  this.feedCache.findEntryWithURL(context.connection, entryURL,
    onFindEntryWithURL.bind(this));

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

    this.feedCache.addEntry(context.connection, entry, callback);
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

}
