// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

class PollingService {
  constructor() {

    this.log = new LoggingService();
    this.log.level = LoggingService.LEVEL_INFO;

    const faviconCache = new FaviconCache('favicon-cache');
    faviconCache.log = new LoggingService();
    faviconCache.log.level = LoggingService.LEVEL_INFO;

    const faviconService = new FaviconService();
    faviconService.cache = faviconCache;
    faviconService.log = new LoggingService();
    faviconService.log.level = LoggingService.LEVEL_INFO;

    this.faviconService = faviconService;

    this.idlePeriodInSeconds = 30;
    this.fetchFeedTimeout = 10 * 1000;
    this.fetchEntryTimeoutMillis = 15 * 1000;
  }

  start() {
    this.log.log('Starting poll ...');

    const context = {
      'pendingFeedsCount': 0,
      'connection': null
    };

    if('onLine' in navigator && !navigator.onLine) {
      this.log.debug('Polling canceled because offline');
      this.onMaybePollCompleted(context);
    }

    // NOTE: untested because connection.navigator is undefined
    // NOTE: dead branch because currently no way to set NO_POLL_METERED
    if('NO_POLL_METERED' in localStorage && navigator.connection &&
      navigator.connection.metered) {
      this.log.debug('Polling canceled on metered connection');
      PollingService.onMaybePollCompleted(context);
    }

    if('ONLY_POLL_IF_IDLE' in localStorage) {
      chrome.idle.queryState(this.idlePeriodInSeconds,
        this.onQueryIdleState.bind(this, context));
    } else {
      db.open(this.onOpenDatabase.bind(this, context));
    }
  }

  onQueryIdleState(context, idleState) {
    if('ONLY_POLL_IF_IDLE' in localStorage) {
      if(idleState === 'locked' || idleState === 'idle') {
        db.open(this.onOpenDatabase.bind(this, context));
      } else {
        this.log.debug('Polling canceled because not idle');
        this.onMaybePollCompleted(context);
      }
    } else {
      db.open(this.onOpenDatabase.bind(this, context));
    }
  }

  // TODO: load all feeds into an array first, then iterate over the array,
  // instead of iterating the cursor
  onOpenDatabase(context, event) {
    if(event.type !== 'success') {
      this.log.error(event);
      this.onMaybePollCompleted(context);
      return;
    }

    const connection = event.target.result;
    context.connection = connection;
    db.openFeedsCursor(connection, this.onOpenFeedsCursor.bind(this, context));
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

    this.log.debug('PollingService: loaded feed from database',
      requestURL.href);

    const excludeEntries = false;
    fetchFeed(requestURL, this.fetchFeedTimeout, excludeEntries,
      this.onFetchFeed.bind(this, context, feed));
    cursor.continue();
  }

  onFetchFeed(context, localFeed, fetchEvent) {
    const feedURLString = localFeed.urls[localFeed.urls.length - 1];
    this.log.debug('PollingService: fetched feed', feedURLString);

    if(fetchEvent.type !== 'load') {
      this.log.debug('PollingService: error fetching',
        localFeed.urls[localFeed.urls.length - 1],
        fetchEvent);
      context.pendingFeedsCount--;
      this.onMaybePollCompleted(context);
      return;
    }

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

    const prefetchedDocument = null;
    const faviconStartingURL = remoteFeed.link ? remoteFeed.link :
      remoteFeed.urls[remoteFeed.urls.length - 1];
    this.faviconService.lookup(faviconStartingURL, prefetchedDocument,
      this.onLookupFeedFavicon.bind(this, context, localFeed, remoteFeed));
  }

  onLookupFeedFavicon(context, localFeed, remoteFeed, faviconURL) {
    this.log.debug('PollingService: fetched favicon',
      localFeed.urls[localFeed.urls.length - 1],
      faviconURL ? faviconURL.href : 'No favicon');

    if(faviconURL) {
      if(localFeed.faviconURLString !== faviconURL.href) {
        this.log.debug('PollingService: Changing feed favicon to',
          faviconURL.href);
      }
      remoteFeed.faviconURLString = faviconURL.href;
    }

    const mergedFeed = this.createMergedFeed(localFeed, remoteFeed);
    const boundOnUpdateFeed = this.onUpdateFeed.bind(this, context,
      remoteFeed.entries, mergedFeed);
    db.updateFeed(context.connection, mergedFeed, boundOnUpdateFeed);
  }

  // TODO: sanitization isn't the responsibility of merging, this is a
  // mixture of purposes. separate out into two functions.
  // TODO: sanitization should consider maximum string length.
  // for enforcing maximum html string length, use truncateHTMLString
  // TODO: maybe sanitizeString should be a db function or something
  // TODO: maybe do the sanitization externally, explicitly
  createMergedFeed(localFeed, remoteFeed) {
    // Prep a string property of an object for storage
    function sanitizeString(inputString) {
      let outputString = inputString;
      if(inputString) {
        outputString = filterControlCharacters(outputString);
        outputString = replaceHTML(outputString, '');
        // Condense whitespace
        // TODO: maybe this should be a utils function
        outputString = outputString.replace(/\s+/, ' ');
        outputString = outputString.trim();
      }
      return outputString;
    }

    const outputFeed = {};
    outputFeed.id = localFeed.id;
    outputFeed.type = remoteFeed.type;
    // TODO: test using spread operator?
    // outputFeed.urls = [...localFeed.urls];
    outputFeed.urls = [].concat(localFeed.urls);

    for(let i = 0, len = remoteFeed.urls.length; i < len; i++) {
      let url = remoteFeed.urls[i];
      let urlString = url.href;
      if(!outputFeed.urls.includes(urlString)) {
        outputFeed.urls.push(urlString);
      }
    }

    // NOTE: title is semi-required. It must be defined, although it can be
    // an empty string. It must be defined because of how views query and
    // iterate over the feeds in the store using title as an index. If it were
    // ever undefined those feeds would not appear in the title index.
    // TODO: remove this requirement somehow? Maybe the options page that
    // retrieves feeds has to manually sort them?
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
    // If there is still pending work we are not actually done
    if(context.pendingFeedsCount) {
      return;
    }

    this.log.log('Polling completed');

    // Not currently in use
    localStorage.LAST_POLL_DATE_MS = '' + Date.now();

    if(localStorage.SHOW_NOTIFICATIONS) {
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
        updateBadgeUnreadCount(context.connection);
      }
    }
  }

  // TODO: do I want to check if any of the entry's URLs exist, or just its
  // most recent one?
  processEntry(context, feed, entry, callback) {

    // If an entry doesn't have a URL, technically I could have allowed it in
    // a scheme were I display text only entries. But I have decided to not
    // allow any entry without a url.
    if(entry.urls.length) {
      this.log.debug('PollingService: processing entry',
        entry.urls[entry.urls.length - 1].href);
    } else {
      this.log.debug('PollingService: entry missing url', entry);
      callback();
      return;
    }

    // Grab the last url in the entry's urls array.
    // entry.urls contains URL objects, not strings
    const entryURL = entry.urls[entry.urls.length - 1];
    db.findEntryWithURL(context.connection, entryURL,
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

      fetchEntryDocument(entryURL, this.fetchEntryTimeoutMillis,
        boundOnFetchEntryDocument);
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
    // over from the serialized feed object that was the input to db.updateFeed
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

    storable.readState = db.EntryFlags.UNREAD;
    storable.archiveState = db.EntryFlags.UNARCHIVED;

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

    db.addEntry(connection, storable, callback);
  }
}
