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
    const urls = feed.urls;
    const requestURL = new URL(urls[urls.length - 1]);
    this.log.debug('PollingService: loaded feed', requestURL.href);

    const excludeEntries = false;
    this.fetchFeedService.fetch(requestURL, excludeEntries,
      this.onFetchFeed.bind(this, context, feed));
    cursor.continue();
  }

  onFetchFeed(context, localFeed, fetchEvent) {
    const feedURLString = localFeed.urls[localFeed.urls.length - 1];

    if(fetchEvent.type !== 'load') {
      this.log.debug('PollingService: error fetching', feedURLString,
        fetchEvent);
      context.pendingFeedsCount--;
      this.onMaybePollCompleted(context);
      return;
    }

    this.log.debug('PollingService: fetched feed', feedURLString);

    const remoteFeed = fetchEvent.feed;
    if(localFeed.dateLastModified && remoteFeed.dateLastModified &&
      localFeed.dateLastModified.getTime() ===
      remoteFeed.dateLastModified.getTime()) {
      this.log.debug('PollingService: feed not modified',
        localFeed.urls[localFeed.urls.length - 1]);
      context.pendingFeedsCount--;
      this.onMaybePollCompleted(context);
      return;
    }

    for(let entry of remoteFeed.entries) {
      this.rewriteEntryURL(entry);
    }

    if(this.faviconService) {
      const prefetchedDocument = null;
      const faviconStartingURL = remoteFeed.link ? remoteFeed.link :
        remoteFeed.urls[remoteFeed.urls.length - 1];
      this.faviconService.lookup(faviconStartingURL, prefetchedDocument,
        this.onLookupFeedFavicon.bind(this, context, localFeed, remoteFeed));
    } else {
      this.onLookupFeedFavicon(context, localFeed, remoteFeed, null);
    }
  }

  rewriteEntryURL(entry) {
    let entryURL = entry.urls[0];
    if(entryURL) {
      let rewrittenURL = rewriteURL(entryURL);
      if(rewrittenURL.href !== entryURL.href) {
        this.log.debug('PollingService: rewriting url', entryURL.href,
          rewrittenURL.href);
        entry.urls.push(rewrittenURL);
      }
    }
  }

  onLookupFeedFavicon(context, localFeed, remoteFeed, faviconURL) {
    if(faviconURL) {
      if(localFeed.faviconURLString !== faviconURL.href) {
        this.log.debug('PollingService: setting feed favicon',
          localFeed.urls[localFeed.urls.length - 1], faviconURL.href);
      }
      remoteFeed.faviconURLString = faviconURL.href;
    }

    const mergedFeed = this.createMergedFeed(localFeed, remoteFeed);
    this.feedCache.updateFeed(context.connection, mergedFeed,
      this.onUpdateFeed.bind(this, context, remoteFeed.entries, mergedFeed));
  }

  createMergedFeed(localFeed, remoteFeed) {
    function sanitizeString(inputString) {
      let outputString = inputString;
      if(inputString) {
        outputString = filterControlCharacters(outputString);
        outputString = replaceHTML(outputString, '');
        outputString = outputString.replace(/\s+/, ' ');
        outputString = outputString.trim();
      }
      return outputString;
    }

    const outputFeed = {};
    outputFeed.id = localFeed.id;
    outputFeed.type = remoteFeed.type;
    outputFeed.urls = [].concat(localFeed.urls);

    for(let i = 0, len = remoteFeed.urls.length; i < len; i++) {
      let url = remoteFeed.urls[i];
      let urlString = url.href;
      if(!outputFeed.urls.includes(urlString)) {
        outputFeed.urls.push(urlString);
      }
    }

    const title = sanitizeString(remoteFeed.title) || localFeed.title || '';
    outputFeed.title = title;

    const description = sanitizeString(remoteFeed.description);
    if(description) {
      outputFeed.description = description;
    } else if(localFeed.description) {
      outputFeed.description = localFeed.description;
    }

    if(remoteFeed.link) {
      outputFeed.link = remoteFeed.link.href;
    } else if(localFeed.link) {
      outputFeed.link = localFeed.link;
    }

    outputFeed.datePublished = remoteFeed.datePublished;
    outputFeed.dateFetched = remoteFeed.dateFetched;
    outputFeed.dateLastModified = remoteFeed.dateLastModified;
    outputFeed.dateCreated = localFeed.dateCreated || new Date();

    if(remoteFeed.faviconURLString) {
      outputFeed.faviconURLString = remoteFeed.faviconURLString;
    } else if(localFeed.faviconURLString) {
      outputFeed.faviconURLString = localFeed.faviconURLString;
    }

    return outputFeed;
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

  // NOTE: feed is now the stored feed, which contains strings not urls
  // However, entries is still the fetched entries array, which contains
  // URL objects.
  // NOTE: because it is the stored feed, it also contains sanitized values
  onUpdateFeed(context, entries, feed, event) {
    if(event.type === 'success') {
      this.log.debug('PollingService: updated feed',
        feed.urls[feed.urls.length - 1]);
    } else {
      this.log.debug('PollingService: error updating feed',
        feed.urls[feed.urls.length - 1]);
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
    for(let i = 0, len = entries.length; i < len; i++) {
      let entry = entries[i];
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

  // TODO: do I want to check if any of the entry's URLs exist, or just its
  // most recent one?
  processEntry(context, feed, entry, callback) {
    if(entry.urls.length) {
      this.log.debug('PollingService: processing entry',
        entry.urls[entry.urls.length - 1].href);
    } else {
      this.log.debug('PollingService: entry missing url', entry);
      callback();
      return;
    }

    const entryURL = entry.urls[entry.urls.length - 1];
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

      // Associate the entry with its feed in preparation for storage
      // TODO: rename this to something clearer, like feedId
      entry.feed = feed.id;

      // Denormalize favicon url and title so that view can avoid lookups
      if(feed.faviconURLString) {
        entry.faviconURLString = feed.faviconURLString;
      }

      // feedTitle was sanitized by updatefeed
      if(feed.title) {
        entry.feedTitle = feed.title;
      }

      if(event.type !== 'success') {
        this.log.debug('request error', event.type, event.requestURL.href);
        this.addEntry(context.connection, entry, callback);
        return;
      }

      // Track the redirect
      if(event.responseURL.href !== entryURL.href) {
        entry.urls.push(event.responseURL);
      }

      // Replace the entry's content
      const document = event.responseXML;
      const contentString = document.documentElement.outerHTML.trim();
      if(contentString) {
        entry.content = contentString;
      }

      this.addEntry(context.connection, entry, callback);
    }
  }

  // TODO: entries must be sanitized fully
  // TODO: eventually this should delegate most of its functionality to
  // Entry.toSerializable, or this should be Entry.add
  // TODO: actually the vast majority of this should be handled by something
  // called FeedCache or FeedStorageService, it should be able to do all of
  // that
  addEntry(connection, entry, callback) {
    const storable = {};

    // entry.feedLink is a URL string, not an object, because it was copied
    // over from the serialized feed object that was the input to updateFeed
    // feedLink was previously sanitized, because it was converted to a URL
    // and back to a string

    if(entry.faviconURLString) {
      storable.faviconURLString = entry.faviconURLString;
    }

    // feedTitle was previously sanitized because it was copied over from the
    // feed object that was sanitized and stored in updateFeed
    if(entry.feedTitle) {
      storable.feedTitle = entry.feedTitle;
    }

    // TODO: rename the property 'feed' to 'feedId'
    // feed id is trusted, no need to sanitize
    storable.feed = entry.feed;

    // Serialize and normalize the urls
    // There is no need to do additional sanitization
    storable.urls = entry.urls.map(function(url) {
      return url.href;
    });

    storable.readState = FeedCache.EntryFlags.UNREAD;
    storable.archiveState = FeedCache.EntryFlags.UNARCHIVED;

    // TODO: sanitize
    if(entry.author) {
      let authorString = entry.author;
      authorString = filterControlCharacters(authorString);
      authorString = replaceHTML(authorString);
      // TODO: do i need to use truncateHTMLString?
      // Does author ever include html entities? If so, should I strip
      // entities?
      // Are those entities encoded or decoded or is it always ambiguous?
      // TODO: if i do use truncateString, then i need to include it in
      // manifest.json
      //authorString = truncateString(authorString, MAX_AUTHOR_VALUE_LENGTH);
      storable.author = entry.author;
    }

    // TODO: enforce a maximum length using truncateHTMLString
    // TODO: condense spaces
    if(entry.title) {
      let entryTitle = entry.title;
      entryTitle = filterControlCharacters(entryTitle);
      entryTitle = replaceHTML(entryTitle, '');
      storable.title = entryTitle;
    }

    if(entry.datePublished) {
      storable.datePublished = entry.datePublished;
    }

    // TODO: filter out non-printable characters other than \r\n\t
    // TODO: enforce a maximum length (using truncateHTMLString)
    if(entry.content) {
      storable.content = entry.content;
    }

    this.feedCache.addEntry(connection, storable, callback);
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
    const images = document.querySelectorAll('img');
    for(let i = 0, len = images.length; i < len; i++) {
      let image = images[i];
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
}
