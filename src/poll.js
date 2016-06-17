// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

const FeedPoller = {};

FeedPoller.start = function() {
  console.log('Starting poll ...');

  const pollContext = {
    'pendingFeedsCount': 0,
    'connection': null
  };

  if('onLine' in navigator && !navigator.onLine) {
    console.log('Polling canceled because offline');
    FeedPoller.onMaybePollCompleted(pollContext);
    return;
  }

  const IDLE_PERIOD_SECONDS = 60;
  if(!localStorage.ONLY_POLL_IF_IDLE) {
    db.open(onOpenDatabase);
  } else {
    chrome.idle.queryState(IDLE_PERIOD_SECONDS, onQueryIdleState);
  }

  function onQueryIdleState(state) {
    if(localStorage.ONLY_POLL_IF_IDLE) {
      if(state === 'locked' || state === 'idle') {
        db.open(onOpenDatabase);
      } else {
        console.log('Polling canceled because not idle');
        FeedPoller.onMaybePollCompleted(pollContext);
      }
    } else {
      db.open(onOpenDatabase);
    }
  }

  function onOpenDatabase(event) {
    if(event.type !== 'success') {
      console.debug(event);
      FeedPoller.onMaybePollCompleted(pollContext);
      return;
    }

    pollContext.connection = event.target.result;
    FeedPoller.iterateFeeds(pollContext);
  }
};

// Iterate over the feeds in the database, and update each feed.
// TODO: react appropriately to request error?
// TODO: are all the requests concurrent?
FeedPoller.iterateFeeds = function(pollContext) {
  const connection = pollContext.connection;
  const iterateFeedsTransaction = connection.transaction('feed');
  const feedStore = iterateFeedsTransaction.objectStore('feed');
  const iterateFeedsRequest = feedStore.openCursor();
  iterateFeedsRequest.onsuccess = onSuccess;

  function onSuccess(event) {
    const request = event.target;
    const cursor = request.result;

    // We either advanced past the last feed or there were no feeds.
    // pendingFeedsCount is unaffected.
    if(!cursor) {
      FeedPoller.onMaybePollCompleted(pollContext);
      return;
    }

    // Increment the counter to signal that a feed is now
    // undergoing an update and that there is at least one update pending
    pollContext.pendingFeedsCount++;

    const feed = cursor.value;

    if(!feed.urls || !feed.urls.length) {
      // TODO: even though this is deprecated, I have to be able to check
      // old feeds, so temp
      if(feed.url) {
        feed.urls = [feed.url];
      } else {
        console.debug('No urls for feed', feed);
        pollContext.pendingFeedsCount--;
        cursor.continue();
        return;
      }
    }

    const requestURLString = feed.urls[feed.urls.length - 1];
    const requestURL = new URL(requestURLString);
    const timeout = 10 * 1000;
    const onFetchFeedBound = FeedPoller.onFetchFeed.bind(null, pollContext,
      feed);
    const excludeEntries = false;
    fetchFeed(requestURL, timeout, excludeEntries, onFetchFeedBound);

    cursor.continue();
  }
};

FeedPoller.onMaybePollCompleted = function(pollContext) {
  // If there is still pending work we are not actually done
  if(pollContext.pendingFeedsCount) {
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

FeedPoller.onFetchFeed = function(pollContext, localFeed, fetchEvent) {
  if(fetchEvent.type !== 'load') {

    console.debug('Failed to fetch feed',
      fetchEvent.responseURL.href,
      fetchEvent.type);

    pollContext.pendingFeedsCount--;
    FeedPoller.onMaybePollCompleted(pollContext);
    return;
  }

  const remoteFeed = fetchEvent.feed;
  if(localFeed.dateLastModified && remoteFeed.dateLastModified &&
    localFeed.dateLastModified.getTime() ===
    remoteFeed.dateLastModified.getTime()) {

    // console.debug('Skipping unmodified feed', fetchEvent.responseURL.href);
    pollContext.pendingFeedsCount--;
    FeedPoller.onMaybePollCompleted(pollContext);
    return;
  }

  // Update the feed's properties in storage and then continue to
  // onPutFeedBound
  // NOTE: remoteFeed.entries is always defined, even when there are no entries
  const onPutFeedBound = FeedPoller.onPutFeed.bind(null, pollContext,
    remoteFeed.entries);
  putFeed(pollContext.connection, localFeed, remoteFeed, onPutFeedBound);
};

FeedPoller.onPutFeed = function(pollContext, entries, feed, putEvent) {

  // NOTE: feed is now the stored feed, which contains strings not urls
  // However, entries is still the fetched entries array, which contains
  // URL objects.

  // If there was a problem updating the feed, then exit. Do not process
  // the feed's entries.
  if(putEvent.type !== 'success') {
    console.error(putEvent);
    pollContext.pendingFeedsCount--;
    FeedPoller.onMaybePollCompleted(pollContext);
    return;
  }

  const numEntries = entries.length;

  // If there are no entries then we are done processing the feed
  if(!numEntries) {
    pollContext.pendingFeedsCount--;
    FeedPoller.onMaybePollCompleted(pollContext);
    return;
  }

  // Process the fetched feed's entries. Filter out entries without urls
  // or that share urls.
  // Entry urls created from fetchFeed are URL objects, not strings.
  // distinct links is a plain object due to performance issues with sets
  const distinctLinks = Object.create(null);
  let entriesProcessed = 0;
  for(let i = 0, j = 0, entry, linkURL, seen = false; i < numEntries; i++) {
    entry = entries[i];

    // If the entry has no URLs, skip the entry
    if(!entry.urls.length) {
      onEntryProcessed();
      continue;
    }

    // If any of the entry's URLs have been seen already, skip the entry
    seen = false;
    for(j = 0; j < entry.urls.length; j++) {
      if(entry.urls[j].href in distinctLinks) {
        seen = true;
        break;
      }
    }

    if(seen) {
      onEntryProcessed();
      continue;
    }

    // Add the entry's URLs to the distinctLinks set of normalized URL strings
    for(j = 0; j < entry.urls.length; j++) {
      distinctLinks[entry.urls[j].href] = 1;
    }

    FeedPoller.processEntry(pollContext, feed, entry, onEntryProcessed);
  }

  function onEntryProcessed(optionalAddEntryEvent) {
    entriesProcessed++;
    if(entriesProcessed === numEntries) {
      pollContext.pendingFeedsCount--;
      FeedPoller.onMaybePollCompleted(pollContext);
      utils.updateBadgeUnreadCount(pollContext.connection);
    }
  }
};

FeedPoller.processEntry = function(pollContext, feed, entry, callback) {

  // Associate the entry with its feed
  // TODO: rename this to something clearer, like feedId
  entry.feed = feed.id;

  // Denormalize link and title so that rendering can avoid these lookups
  entry.feedLink = feed.link;
  entry.feedTitle = feed.title;

  // Use the feed's date if the entry's date is not set
  // TODO: I think this is the responsibility of the parser actually
  // TODO: rename pubdate to datePublished
  // TODO: use Date objects
  // TODO: rename feed date to something clearer
  if(!entry.pubdate && feed.date) {
    entry.pubdate = feed.date;
  }

  // TODO: do I want to check if any of the entry's URLs exist, or just its
  // most recent one?

  // Check whether an entry with the url already exists. Grab the last url
  // in the entry's urls array.
  // The entry object was fetched, so entry.urls contains URL objects
  const entryURL = entry.urls[entry.urls.length - 1];

  const connection = pollContext.connection;
  const transaction = connection.transaction('entry');
  const entryStore = transaction.objectStore('entry');
  const urlsIndex = entryStore.index('urls');
  const request = urlsIndex.get(entryURL.href);
  request.onsuccess = findExistingEntryOnSuccess;
  request.onerror = findExistingEntryOnError;

  function findExistingEntryOnError(event) {
    console.debug(event);
    callback();
  }

  function findExistingEntryOnSuccess(event) {
    const findRequest = event.target;
    const localEntry = findRequest.result;

    if(localEntry) {
      callback();
      return;
    }

    if(FeedPoller.isNoFetchURL(entryURL)) {
      // console.debug('Not fetching blacklisted entry link', entryURL.href);
      FeedPoller.addEntry(pollContext.connection, entry, callback);
      return;
    }

    const path = entryURL.pathname;
    if(path && path.length > 5 && /\.pdf$/i.test(path)) {
      // console.debug('Not fetching pdf entry link', entryURL.href);
      FeedPoller.addEntry(pollContext.connection, entry, callback);
      return;
    }

    const fetchTimeoutMillis = 20 * 1000;
    const fetchRequest = new XMLHttpRequest();
    fetchRequest.timeout = fetchTimeoutMillis;
    fetchRequest.ontimeout = onFetchEntry;
    fetchRequest.onerror = onFetchEntry;
    fetchRequest.onabort = onFetchEntry;
    fetchRequest.onload = onFetchEntry;
    const doAsyncFetchRequest = true;
    fetchRequest.open('GET', entryURL.href, doAsyncFetchRequest);
    fetchRequest.responseType = 'document';
    fetchRequest.send();
  }

  function onFetchEntry(event) {

    // TODO: if an entry cannot be fetched, we should still store the entry
    // somehow so that we do not continually try and refetch the entry or
    // something like this. At least for some period of time, because the entry
    // may have just been temporarily unavailable or recently made available

    if(event.type !== 'load') {
      console.debug(event);
      FeedPoller.addEntry(pollContext.connection, entry, callback);
      return;
    }

    const fetchRequest = event.target;
    const document = fetchRequest.responseXML;

    // This happens with non-html content types like pdf. In this case we
    // still want to add the entry, we just do not augment its content.
    if(!document) {
      FeedPoller.addEntry(pollContext.connection, entry, callback);
      return;
    }

    // When a redirect occurred, append the
    // post-redirect URL to the entry's list of URLs.
    const responseURL = new URL(fetchRequest.responseURL);
    if(responseURL.href !== entryURL.href) {
      // console.debug('Entry redirect', entryURL.href, responseURL.href);
      entry.urls.push(responseURL);
    }

    // TODO: move URLResolver back into poll.js, this is the only place
    // it is called, and it really isn't a general purpose library.

    FeedPoller.transformLazilyLoadedImages(document);
    FeedPoller.filterSourcelessImages(document);
    URLResolver.resolveURLsInDocument(document, responseURL.href);
    FeedPoller.filterTrackingImages(document);
    FeedPoller.fetchImageDimensions(document, onSetImageDimensions);
  }

  // Possibly replace the content property of the remoteEntry with the
  // fetched and cleaned full text, then store the entry.
  // TODO: maybe I should be checking the content of body. In fact if
  // there is no body element, maybe this shouldn't even be replacing
  // entry.content at all. Maybe documentElement is the wrong thing
  // to consider. Maybe I want to check body but use the full content
  // of documentElement.
  // Also, maybe I want to use an substitute message.
  function onSetImageDimensions(document, fetchStats) {
    const documentElement = document.documentElement;
    if(documentElement) {
      const fullDocumentHTMLString = documentElement.outerHTML;
      if(fullDocumentHTMLString) {
        const trimmedFullDocumentHTMLString = fullDocumentHTMLString.trim();
        if(trimmedFullDocumentHTMLString) {
          entry.content = trimmedFullDocumentHTMLString;
        }
      }
    }

    FeedPoller.addEntry(pollContext.connection, entry, callback);
  }
};

// TODO: make sure pubdate has a consistent value. I am using
// date.getTime here, but I am not sure I am using the same
// or similar every where else. Like in poll denormalize
// TODO: rename pubdate to something clearer, like datePublished or something
// to that effect.
// TODO: I should be using Date objects for date values. Not timestamps.
FeedPoller.addEntry = function(connection, entry, callback) {
  const storable = Object.create(null);

  // entry.feedLink is a URL object, so it must be serialized. entry.feedLink
  // is derived from feed.link earlier, which could be undefined, because
  // feeds are not required to have a link property (which is not to be
  // confused with the urls array property)
  if(entry.feedLink) {
    storable.feedLink = entry.feedLink.href;
  }

  if(entry.feedTitle) {
    storable.feedTitle = entry.feedTitle;
  }

  storable.feed = entry.feed;

  // entry.urls is an array of URL objects. Each must be serialized.
  storable.urls = [];
  for(let i = 0, len = entry.urls.length; i < len; i++) {
    storable.urls.push(entry.urls[i].href);
  }

  storable.readState = db.EntryFlags.UNREAD;
  storable.archiveState = db.EntryFlags.UNARCHIVED;

  if(entry.author) {
    storable.author = entry.author;
  }

  if(entry.title) {
    storable.title = entry.title;
  }

  // TODO: the pubdate field should be named datePublished so as to be
  // consistent with other field names
  // TODO: store a Date object instead of a timestamp
  if(entry.pubdate) {
    const date = new Date(entry.pubdate);
    if(utils.date.isValid(date)) {
      storable.pubdate = date.getTime();
    }
  }

  // TODO: rename to dateCreated
  // TODO: store a Date object instead of a timestamp
  storable.created = Date.now();

  if(entry.content) {
    storable.content = entry.content;
  }

  // Use an isolated transaction for storing an entry. The problem with using a
  // shared transaction in the case of a batch insert is that the uniqueness
  // check from index constraints is db-delegated and unknown apriori without a
  // separate lookup request, and that any constraint failure causes the entire
  // transaction to fail.

  // TODO: because I am not checking existing of all of an entry's urls, just
  // its most recent, I am unclear as to whether there is actually a chance
  // of a ConstraintError, so maybe I should look into testing that. One
  // concern is also that this might cause a thrown exception instead of
  // request error event, and I am not currently checking for that.

  const transaction = connection.transaction('entry', 'readwrite');
  transaction.oncomplete = callback;
  const store = transaction.objectStore('entry');
  store.add(storable);
};

// TODO: rename to be clearer that this deals with entry urls, not feeds
FeedPoller.isNoFetchURL = function(url) {
  const blacklist = [
    'productforums.google.com',
    'groups.google.com',
    // Forbes uses a Continue page preventing crawling
    'www.forbes.com',
    'forbes.com'
  ];
  const hostname = url.hostname;
  for(let i = 0, len = blacklist.length; i < len; i++) {
    if(blacklist[i] === hostname) {
      return true;
    }
  }
  return false;
};

FeedPoller.getLiveDocument = function() {
  return document;
};

// TODO: think more about how to deal with srcsets if I don't know beforehand
// which image will be used. This impacts the boilerplate analysis.
FeedPoller.fetchImageDimensions = function(document, callback) {
  const stats = {
    'numProcessed': 0,
    'numFetched': 0
  };

  const imageCollection = document.getElementsByTagName('img');
  const numImages = imageCollection.length;
  if(!numImages) {
    callback(document, stats);
    return;
  }

  for(let i = 0, imageElement, urlString; i < numImages; i++) {
    imageElement = imageCollection[i];

    if(imageElement.width && !imageElement.hasAttribute('width')) {
      imageElement.setAttribute('width', imageElement.width);
    }

    if(imageElement.height && !imageElement.hasAttribute('height')) {
      imageElement.setAttribute('height', imageElement.height);
    }

    if(imageElement.hasAttribute('width') &&
      imageElement.hasAttribute('height')) {
      onImageProcessed(imageElement);
      continue;
    }

    urlString = imageElement.getAttribute('src') || '';

    // Do not fetch object URLs
    if(urlString && /^\s*data\s*:/i.test(urlString)) {
      onImageProcessed(imageElement);
      continue;
    }

    if(urlString.length < 9 || !/^\s*http/i.test(urlString)) {
      onImageProcessed(imageElement);
      continue;
    }

    fetchImage(imageElement);
  }

  function fetchImage(imageElement) {
    const sourceURLString = imageElement.getAttribute('src');
    const hostDocument = FeedPoller.getLiveDocument();
    const proxyImageElement = hostDocument.createElement('img');
    const boundOnFetchImage = onFetchImage.bind(null, imageElement);
    proxyImageElement.onload = boundOnFetchImage;
    proxyImageElement.onerror = boundOnFetchImage;
    proxyImageElement.src = sourceURLString;
  }

  function onFetchImage(imageElement, event) {
    stats.numFetched++;
    const proxyImageElement = event.target;
    if(event.type === 'load') {
      if(!imageElement.hasAttribute('width')) {
        imageElement.setAttribute('width', proxyImageElement.width);
      }

      if(!imageElement.hasAttribute('height')) {
        imageElement.setAttribute('height', proxyImageElement.height);
      }
    } else {
      // TODO: if I got an error, consider removing the image element
      // from the document. Also, don't forget that if I do this I need
      // to be using a static node list, as in, I need to be using
      // querySelectorAll and not getElementsByTagName
    }

    onImageProcessed(imageElement);
  }

  // TODO: unsure if I need the imageElement argument. I think it is simply a
  // remnant of some debugging work.
  function onImageProcessed(imageElement) {
    stats.numProcessed++;
    if(stats.numProcessed === numImages) {
      callback(document, stats);
    }
  }
};

FeedPoller.filterSourcelessImages = function(document) {
  const images = document.querySelectorAll('img');
  for(let i = 0, len = images.length, image, src; i < len; i++) {
    image = images[i];
    if(!image.hasAttribute('src') && !image.hasAttribute('srcset')) {
      // console.debug('Removing sourcless image', image.outerHTML);
      image.remove();
      break;
    }
  }
};

// Remove images that merely serve to register http requests for website
// statistics
// TODO: I am not seeing any of the last 4 urls here being filtered. Maybe
// I am looking for the wrong thing? I have not seen these occur even
// once? Are they just script origins?
FeedPoller.filterTrackingImages = function(document) {
  const SELECTOR = [
    'img[src^="http://b.scorecardresearch.com"]',
    'img[src^="https://b.scorecardresearch.com"]',
    'img[src^="http://pagead2.googlesyndication.com"]',
    'img[src^="https://pagead2.googlesyndication.com"]',
    'img[src^="http://pubads.g.doubleclick.net"]',
    'img[src^="https://pubads.g.doubleclick.net"]'
  ].join(',');
  const images = document.querySelectorAll(SELECTOR);
  for(let i = 0, len = images.length; i < len; i++) {
    // console.debug('Removing tracker:', images[i].outerHTML);
    images[i].remove();
  }
};

FeedPoller.transformLazilyLoadedImages = function(document) {

  const NAMES = [
    'load-src',
    'data-src',
    'data-original-desktop',
    'data-baseurl',
    'data-lazy',
    'data-img-src',
    'data-original',
    'data-adaptive-img',
    'data-imgsrc',
    'data-default-src'
  ];

  const numNames = NAMES.length;
  const images = document.querySelectorAll('img');
  for(let i = 0, j = 0, len = images.length, image, name, altSrc; i < len;
    i++) {
    image = images[i];
    // Only examine those images without a src attribute value
    if(!(image.getAttribute('src') || '').trim()) {
      // Look for alternate source url attributes
      // There isn't much URL validation I can do because this occurs before
      // URLs are resolved, so I cannot for example expect all urls to have
      // a protocol. I can, however, check the value is non-empty and does not
      // have an inner space. Although perhaps this is overly restrictive
      // because the browser may tolerate sloppy URLs that contain inner
      // spaces.
      for(j = 0; j < numNames; j++) {
        name = NAMES[j];
        if(image.hasAttribute(name)) {
          altSrc = (image.getAttribute(name) || '').trim();
          if(altSrc && !altSrc.includes(' ')) {
            // console.debug('Lazy load transform', altSrc);
            image.removeAttribute(name);
            image.setAttribute('src', altSrc);
            break;
          }
        }
      }
    }
  }
};
