// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

const FeedPoller = Object.create(null);

FeedPoller.start = function() {
  console.log('Starting poll...');

  const context = {
    'pendingFeedsCount': 0,
    'connection': null
  };

  if('onLine' in navigator && !navigator.onLine) {
    console.log('Polling canceled because offline');
    FeedPoller.onMaybePollCompleted(context);
    return 'Offline';
  }

  // NOTE: untested because connection.navigator is undefined
  // NOTE: dead branch because currently no way to set NO_POLL_METERED
  if('NO_POLL_METERED' in localStorage && navigator.connection &&
    navigator.connection.metered) {
    console.log('Polling canceled on metered connection');
    FeedPoller.onMaybePollCompleted(context);
    return 'Metered connection';
  }

  if('ONLY_POLL_IF_IDLE' in localStorage) {
    const IDLE_PERIOD_SECONDS = 60;
    chrome.idle.queryState(IDLE_PERIOD_SECONDS, onQueryIdleState);
  } else {
    db.open(onOpenDatabase);
  }

  function onQueryIdleState(state) {
    if('ONLY_POLL_IF_IDLE' in localStorage) {
      if(state === 'locked' || state === 'idle') {
        db.open(onOpenDatabase);
      } else {
        console.log('Polling canceled because not idle');
        FeedPoller.onMaybePollCompleted(context);
      }
    } else {
      db.open(onOpenDatabase);
    }
  }

  function onOpenDatabase(event) {
    if(event.type !== 'success') {
      console.debug(event);
      FeedPoller.onMaybePollCompleted(context);
      return;
    }

    const connection = event.target.result;
    context.connection = connection;

    // TODO: load all feeds into an array first, then iterate over the array,
    // instead of iterating the cursor
    db.openFeedsCursor(connection, onOpenFeedsCursor);
  }

  function onOpenFeedsCursor(event) {
    if(event.type !== 'success') {
      FeedPoller.onMaybePollCompleted(context);
      return;
    }

    const cursor = event.target.result;
    if(!cursor) {
      FeedPoller.onMaybePollCompleted(context);
      return;
    }

    context.pendingFeedsCount++;
    const feed = cursor.value;
    const urls = feed.urls;
    const requestURL = new URL(urls[urls.length - 1]);
    const fetchTimeout = 10 * 1000;
    const excludeEntries = false;
    const onFetchFeedBound = onFetchFeed.bind(null, feed);
    fetchFeed(requestURL, fetchTimeout, excludeEntries, onFetchFeedBound);
    cursor.continue();
  }

  function onFetchFeed(localFeed, fetchEvent) {
    if(fetchEvent.type !== 'load') {
      context.pendingFeedsCount--;
      FeedPoller.onMaybePollCompleted(context);
      return;
    }

    const remoteFeed = fetchEvent.feed;
    if(localFeed.dateLastModified && remoteFeed.dateLastModified &&
      localFeed.dateLastModified.getTime() ===
      remoteFeed.dateLastModified.getTime()) {
      context.pendingFeedsCount--;
      FeedPoller.onMaybePollCompleted(context);
      return;
    }

    if(remoteFeed.link) {
      const faviconCache = new FaviconCache('favicon-cache');
      faviconCache.log = new LoggingService();
      faviconCache.log.level = LoggingService.LEVEL_ERROR;

      const faviconService = new FaviconService();
      faviconService.cache = faviconCache;
      faviconService.log = new LoggingService();
      faviconService.log.level = LoggingService.LEVEL_ERROR;

      const boundOnFetchFavicon = onFetchFavicon.bind(null, localFeed,
        remoteFeed);
      faviconService.lookup(remoteFeed.link, null, boundOnFetchFavicon);
    } else {
      onFetchFavicon(localFeed, remoteFeed, null);
    }
  }

  function onFetchFavicon(localFeed, remoteFeed, faviconURL) {
    if(faviconURL) {
      remoteFeed.faviconURLString = faviconURL.href;
    }

    const mergedFeed = FeedPoller.createMergedFeed(localFeed, remoteFeed);
    const onUpdateFeed = FeedPoller.onUpdateFeed.bind(null, context,
      remoteFeed.entries, mergedFeed);
    db.updateFeed(context.connection, mergedFeed, onUpdateFeed);
  }

  // Show something when called from console
  return 'Polling started...';
};

FeedPoller.createMergedFeed = function(localFeed, remoteFeed) {

  // TODO: sanitization isn't the responsibility of merging, this is a mixture
  // of purposes. separate out into two functions.

  // TODO: sanitization should consider maximum string length.
  // for enforcing maximum html string length, use truncateHTMLString

  // Prep a string property of an object for storage
  // TODO: maybe this should be a db function or something
  // TODO: maybe do the sanitization externally, explicitly
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

  const outputFeed = Object.create(null);
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
};

FeedPoller.onMaybePollCompleted = function(context) {
  // If there is still pending work we are not actually done
  if(context.pendingFeedsCount) {
    return;
  }

  console.log('Polling completed');
  localStorage.LAST_POLL_DATE_MS = '' + Date.now();

  if(localStorage.SHOW_NOTIFICATIONS) {
    const notification = {
      'type': 'basic',
      'title': chrome.runtime.getManifest().name,
      'iconUrl': '/images/rss_icon_trans.gif',
      'message': 'Updated articles'
    };
    chrome.notifications.create('Lucubrate', notification, function() {});
  }
};

// NOTE: feed is now the stored feed, which contains strings not urls
// However, entries is still the fetched entries array, which contains
// URL objects.
// NOTE: because it is the stored feed, it also contains sanitized values
FeedPoller.onUpdateFeed = function(context, entries, feed, event) {
  if(event.type !== 'success') {
    context.pendingFeedsCount--;
    FeedPoller.onMaybePollCompleted(context);
    return;
  }

  if(!entries.length) {
    context.pendingFeedsCount--;
    FeedPoller.onMaybePollCompleted(context);
    return;
  }

  let entriesProcessed = 0;
  for(let i = 0, len = entries.length; i < len; i++) {
    let entry = entries[i];
    FeedPoller.processEntry(context, feed, entry, onEntryProcessed);
  }

  function onEntryProcessed(optionalAddEntryEvent) {
    entriesProcessed++;
    if(entriesProcessed === entries.length) {
      context.pendingFeedsCount--;
      FeedPoller.onMaybePollCompleted(context);
      updateBadgeUnreadCount(context.connection);
    }
  }
};

// TODO: do I want to check if any of the entry's URLs exist, or just its
// most recent one?
FeedPoller.processEntry = function(context, feed, entry, callback) {

  // If an entry doesn't have a URL, technically I could have allowed it in
  // a scheme were I display text only entries. But I have decided to not allow
  // any entry without a url.
  // TODO: did I already check for this earlier in the pipeline?
  if(!entry.urls.length) {
    callback();
    return;
  }

  // Grab the last url in the entry's urls array.
  // entry.urls contains URL objects, not strings
  const entryURL = entry.urls[entry.urls.length - 1];

  db.findEntryWithURL(context.connection, entryURL, onFindEntryWithURL);

  function onFindEntryWithURL(event) {
    if(event.type !== 'success') {
      callback();
      return;
    }

    if(event.target.result) {
      callback();
      return;
    }

    const fetchTimeoutMillis = 15 * 1000;
    fetchEntryDocument(entryURL, fetchTimeoutMillis, onFetchEntryDocument);
  }

  function onFetchEntryDocument(event) {

    // Associate the entry with its feed in preparation for storage
    // TODO: rename this to something clearer, like feedId
    entry.feed = feed.id;

    // Denormalize favicon url and title so that view can avoid lookups

    if(feed.faviconURLString) {
      entry.faviconURLString = feed.favionURLString;
    }


    // feedTitle was sanitized by updatefeed
    if(feed.title) {
      entry.feedTitle = feed.title;
    }


    if(event.type !== 'success') {
      console.debug('request error', event.type, event.requestURL.href);

      FeedPoller.addEntry(context.connection, entry, callback);
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

    FeedPoller.addEntry(context.connection, entry, callback);
  }
};

// TODO: entries must be sanitized fully
// TODO: eventually this should delegate most of its functionality to
// Entry.toSerializable, or this should be Entry.add
// TODO: actually the vast majority of this should be handled by something
// called FeedCache or FeedStorageService, it should be able to do all of that
FeedPoller.addEntry = function(connection, entry, callback) {
  const storable = Object.create(null);

  // entry.feedLink is a URL string, not an object, because it was copied
  // over from the serialized feed object that was the input to db.updateFeed
  // feedLink was previously sanitized, because it was converted to a URL
  // and back to a string
  //if(entry.feedLink) {
  //  storable.feedLink = entry.feedLink;
  //}

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
    // Does author ever include html entities? If so, should I strip entities?
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
};
