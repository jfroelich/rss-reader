// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

class PollingService {

  constructor() {
    this.log = new LoggingService();
    this.idlePeriodInSeconds = 30;
    this.fetchEntryTimeoutMillis = 15 * 1000;
    this.feedCache = new FeedCache();
    this.faviconService = new FaviconService();
    this.imageDimensionsService = new ImageDimensionsService();
    this.badgeUpdateService = new BadgeUpdateService();
    this.fetchFeedService = new FeedHttpService();
    this.fetchFeedService.timeoutMillis = 10 * 1000;
    this.urlRewritingService = new URLRewritingService();
  }

  start() {
    this.log.log('PollingService: starting...');

    const context = {
      'pendingFeedsCount': 0,
      'connection': null
    };

    if(this.isOffline()) {
      this.log.debug('PollingService: canceled because offline');
      this.onMaybePollCompleted(context);
      return;
    }

    if(this.isMeteredConnection()) {
      this.log.debug('PollingService: canceled because metered connection');
      this.onMaybePollCompleted(context);
      return;
    }

    if('ONLY_POLL_IF_IDLE' in localStorage) {
      chrome.idle.queryState(this.idlePeriodInSeconds,
        this.onQueryIdleState.bind(this, context));
    } else {
      this.feedCache.open(this.onOpenDatabase.bind(this, context));
    }
  }

  isOffline() {
    return 'onLine' in navigator && !navigator.onLine;
  }

  isMeteredConnection() {
    return 'NO_POLL_METERED' in localStorage && navigator.connection &&
      navigator.connection.metered;
  }

  onQueryIdleState(context, idleState) {
    if('ONLY_POLL_IF_IDLE' in localStorage) {
      if(idleState === 'locked' || idleState === 'idle') {
        this.feedCache.open(this.onOpenDatabase.bind(this, context));
      } else {
        this.log.debug('Polling canceled because not idle');
        this.onMaybePollCompleted(context);
      }
    } else {
      this.feedCache.open(this.onOpenDatabase.bind(this, context));
    }
  }

  onOpenDatabase(context, connection) {
    if(connection) {
      context.connection = connection;
      this.feedCache.openFeedsCursor(connection,
        this.onOpenFeedsCursor.bind(this, context));
    } else {
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
    if(localFeed.dateLastModified && remoteFeed.dateLastModified &&
      localFeed.dateLastModified.getTime() ===
      remoteFeed.dateLastModified.getTime()) {
      this.log.debug('PollingService: feed not modified',
        Feed.prototype.getURL.call(localFeed));
      context.pendingFeedsCount--;
      this.onMaybePollCompleted(context);
      return;
    }

    if(this.faviconService) {
      if(remoteFeed.link) {
        this.faviconService.lookup(remoteFeed.link, null,
          this.onLookupFeedFavicon.bind(this, context, localFeed, remoteFeed));
      } else {
        this.faviconService.lookup(Feed.prototype.getURL.call(remoteFeed),
          fetchEvent.responseXML,
          this.onLookupFeedFavicon.bind(this, context, localFeed, remoteFeed));
      }
    } else {
      this.onLookupFeedFavicon(context, localFeed, remoteFeed, null);
    }
  }

  onLookupFeedFavicon(context, localFeed, remoteFeed, faviconURL) {
    if(faviconURL) {
      remoteFeed.faviconURLString = faviconURL.href;
    }

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

    if(!entries.length) {
      context.pendingFeedsCount--;
      this.onMaybePollCompleted(context);
      return;
    }

    let entriesProcessed = 0;
    const boundOnEntryProcessed = onEntryProcessed.bind(this);
    for(let entry of entries) {
      this.processEntry(context, feed, entry, boundOnEntryProcessed);
    }

    function onEntryProcessed(optionalAddEntryEvent) {
      entriesProcessed++;
      if(entriesProcessed === entries.length) {
        context.pendingFeedsCount--;
        this.onMaybePollCompleted(context);
        this.badgeUpdateService.updateCount();
      }
    }
  }

  processEntry(context, feed, entry, callback) {
    if(!Entry.prototype.hasURL.call(entry)) {
      this.log.debug('PollingService: entry missing url', entry);
      callback();
      return;
    }

    this.log.debug('PollingService: processing entry',
      Entry.prototype.getURL.call(entry).href);

    // Rewrite the entry's url. Because it was fetched we know there is
    // only one.
    const firstURL = entry.urls[0];
    if(firstURL) {
      const rewrittenURL = this.urlRewritingService.rewriteURL(firstURL);
      if(rewrittenURL.href !== firstURL.href) {
        entry.urls.push(rewrittenURL);
      }
    }

    // Now use the terminal url to lookup
    const entryURL = Entry.prototype.getURL.call(entry);
    this.feedCache.findEntryWithURL(context.connection, entryURL,
      onFindEntryWithURL.bind(this));

    const boundOnFetchEntryDocument = onFetchEntryDocument.bind(this);

    function onFindEntryWithURL(event) {
      if(event.type !== 'success') {
        callback();
        return;
      }

      if(event.target.result) {
        callback();
        return;
      }

      this.fetchEntryDocument(entryURL, boundOnFetchEntryDocument);
    }

    function onFetchEntryDocument(event) {

      entry.feed = feed.id;
      if(feed.faviconURLString) {
        entry.faviconURLString = feed.faviconURLString;
      }

      if(feed.title) {
        entry.feedTitle = feed.title;
      }

      if(event.type !== 'success') {
        this.log.debug('PollingService: fetch error', event.type,
          event.requestURL.href);
        this.feedCache.addEntry(context.connection, entry, callback);
        return;
      }

      if(event.responseURL.href !== entryURL.href) {
        entry.urls.push(event.responseURL);
      }

      // Replace the entry's content
      const document = event.responseXML;
      const contentString = document.documentElement.outerHTML.trim();
      if(contentString) {
        entry.content = contentString;
      }

      this.feedCache.addEntry(context.connection, entry, callback);
    }
  }

  fetchEntryDocument(requestURL, callback) {
    this.log.debug('PollingService: fetching', requestURL.href);
    if(this.isResistantURL(requestURL)) {
      callback({'type': 'resistanturl', 'requestURL': requestURL});
      return;
    }

    const path = requestURL.pathname;
    if(path && path.length > 5 && /\.pdf$/i.test(path)) {
      callback({'type': 'pdfurl', 'requestURL': requestURL});
      return;
    }

    const boundOnResponse = onResponse.bind(this);
    const fetchRequest = new XMLHttpRequest();
    fetchRequest.timeout = this.fetchEntryTimeoutMillis;
    fetchRequest.ontimeout = boundOnResponse;
    fetchRequest.onerror = boundOnResponse;
    fetchRequest.onabort = boundOnResponse;
    fetchRequest.onload = boundOnResponse;
    const async = true;
    fetchRequest.open('GET', requestURL.href, async);
    fetchRequest.responseType = 'document';
    fetchRequest.setRequestHeader('Accept', 'text/html');
    fetchRequest.send();

    function onResponse(event) {
      const outputEvent = {
        'requestURL': requestURL
      };

      if(event.type !== 'load') {
        outputEvent.type = event.type;
        callback(outputEvent);
        return;
      }

      const document = event.target.responseXML;
      if(!document) {
        outputEvent.type = 'undefineddocument';
        callback(outputEvent);
        return;
      }

      outputEvent.type = 'success';
      const responseURL = new URL(event.target.responseURL);
      outputEvent.responseURL = responseURL;
      transformLazilyLoadedImages(document);
      this.filterSourcelessImages(document);
      resolveDocumentURLs(document, responseURL);
      filterTrackingImages(document);
      if(this.imageDimensionsService) {
        this.imageDimensionsService.modifyDocument(document,
          onSetImageDimensions.bind(this, outputEvent));
      } else {
        outputEvent.responseXML = document;
        callback(event);
      }
    }

    function onSetImageDimensions(event, document) {
      event.responseXML = document;
      callback(event);
    }
  }

  filterSourcelessImages(document) {
    for(let image of document.querySelectorAll('img')) {
      if(!image.hasAttribute('src') && !image.hasAttribute('srcset')) {
        image.remove();
        break;
      }
    }
  }

  isResistantURL(url) {
    const blacklist = [
      'productforums.google.com',
      'groups.google.com',
      'www.forbes.com',
      'forbes.com'
    ];

    // hostname getter normalizes url part to lowercase
    return blacklist.includes(url.hostname);
  }


  onMaybePollCompleted(context) {
    if(context.pendingFeedsCount) {
      return;
    }

    this.log.log('Polling completed');

    if('SHOW_NOTIFICATIONS' in localStorage) {
      this.showPollCompletedNotification();
    }
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
