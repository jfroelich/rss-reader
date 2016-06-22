// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

// TOP TODO: ran it and didn't see poll completed, look into this

const FeedPoller = Object.create(null);

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
// TODO: maybe just make this into a helper function above
FeedPoller.iterateFeeds = function(pollContext) {

  const connection = pollContext.connection;
  db.openFeedsCursor(connection, onSuccess);

  function onSuccess(event) {
    const request = event.target;
    const cursor = request.result;

    // We either advanced past the last feed or there were no feeds.
    // pendingFeedsCount is unaffected.
    if(!cursor) {
      FeedPoller.onMaybePollCompleted(pollContext);
      return;
    }

    const feed = cursor.value;
    let urls = feed.urls;

    // Handle older feeds or feeds without urls
    if(!urls || !urls.length) {
      if(feed.url) {
        feed.urls = [feed.url];
        urls = feed.urls;
        delete feed.url;
      } else {
        console.debug('No urls for feed', feed);
        cursor.continue();
        return;
      }
    }

    pollContext.pendingFeedsCount++;
    const requestURL = new URL(urls[urls.length - 1]);
    const timeout = 10 * 1000;
    const excludeEntries = false;
    const onFetchFeedBound = FeedPoller.onFetchFeed.bind(null, pollContext,
      feed);
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
    pollContext.pendingFeedsCount--;
    FeedPoller.onMaybePollCompleted(pollContext);
    return;
  }

  const remoteFeed = fetchEvent.feed;
  if(localFeed.dateLastModified && remoteFeed.dateLastModified &&
    localFeed.dateLastModified.getTime() ===
    remoteFeed.dateLastModified.getTime()) {
    pollContext.pendingFeedsCount--;
    FeedPoller.onMaybePollCompleted(pollContext);
    return;
  }

  const entries = remoteFeed.entries;
  const onPutFeed = FeedPoller.onPutFeed.bind(null, pollContext,
    entries);
  db.putFeed(pollContext.connection, localFeed, remoteFeed, onPutFeed);
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
      updateBadgeUnreadCount(pollContext.connection);
    }
  }
};

FeedPoller.processEntry = function(pollContext, feed, entry, callback) {

  // Associate the entry with its feed
  // TODO: rename this to something clearer, like feedId
  entry.feed = feed.id;

  // Denormalize link and title so that rendering can avoid these lookups
  // NOTE: feed.link is a URL string, because feed comes from the feed object
  // that was stored
  entry.feedLink = feed.link;
  entry.feedTitle = feed.title;

  // Use the feed's date if the entry's date is not set
  // TODO: move this feature to feed-parser or fetch-feed
  // TODO: rename pubdate to datePublished
  // TODO: use Date objects
  // TODO: rename feed date to something clearer
  if(!entry.pubdate && feed.date) {
    entry.pubdate = feed.date;
  }

  // TODO: do I want to check if any of the entry's URLs exist, or just its
  // most recent one?

  // Check whether an entry with the url already exists. Grab the last url
  // in the entry's urls array. entry.urls provides URL objects, not strings,
  // because fetchFeed converts them into URL objects.
  const entryURL = entry.urls[entry.urls.length - 1];
  const connection = pollContext.connection;
  db.findEntryWithURL(connection, entryURL, onFindEntryWithURL);

  function onFindEntryWithURL(event) {
    if(event.type !== 'success') {
      callback();
      return;
    }

    if(event.target.result) {
      callback();
      return;
    }

    if(FeedPoller.isNoFetchURL(entryURL)) {
      FeedPoller.addEntry(pollContext.connection, entry, callback);
      return;
    }

    const path = entryURL.pathname;
    if(path && path.length > 5 && /\.pdf$/i.test(path)) {
      FeedPoller.addEntry(pollContext.connection, entry, callback);
      return;
    }

    const fetchTimeoutMillis = 15 * 1000;
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
    if(event.type !== 'load') {
      console.debug(event);
      FeedPoller.addEntry(pollContext.connection, entry, callback);
      return;
    }

    const fetchRequest = event.target;
    const document = fetchRequest.responseXML;
    if(!document) {
      FeedPoller.addEntry(pollContext.connection, entry, callback);
      return;
    }

    const responseURL = new URL(fetchRequest.responseURL);
    if(responseURL.href !== entryURL.href) {
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

// TODO: rename pubdate to something clearer, like datePublished or something
// to that effect.
// TODO: I should be using Date objects for date values. Not timestamps.
FeedPoller.addEntry = function(connection, entry, callback) {

  console.debug('Storing entry', entry.urls[entry.urls.length - 1].href);

  const storable = Object.create(null);

  // entry.feedLink is a URL string, not an object, because it was copied
  // over from the feed object that was the result of db.putFeed
  if(entry.feedLink) {
    storable.feedLink = entry.feedLink;
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
    if(FeedPoller.isValidDate(date)) {
      storable.pubdate = date.getTime();
    }
  }

  // TODO: rename to dateCreated
  // TODO: store a Date object instead of a timestamp
  storable.created = Date.now();

  if(entry.content) {
    storable.content = entry.content;
  }

  // NOTE: I think this was the bug, I wasn't passing the callback to
  // the new function, so this was never calling back.
  db.addEntry(connection, storable, callback);
};

// TODO: check whether there is a better way to do this in ES6
// TODO: compare to other lib implementations, e.g. underscore/lo-dash
// See http://stackoverflow.com/questions/1353684
FeedPoller.isValidDate = function(dateObject) {
  const OBJECT_TO_STRING = Object.prototype.toString;
  return dateObject && OBJECT_TO_STRING.call(dateObject) === '[object Date]' &&
    isFinite(dateObject);
};

// TODO: rename to be clearer that this deals with entry urls, not feeds
FeedPoller.isNoFetchURL = function(url) {
  const blacklist = [
    'productforums.google.com',
    'groups.google.com',
    // Forbes uses a Continue page preventing crawling
    // url normalization currently does not do anything with www. prefix so
    // i have to check both
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
    if(!(image.getAttribute('src') || '').trim()) {
      for(j = 0; j < numNames; j++) {
        name = NAMES[j];
        if(image.hasAttribute(name)) {
          altSrc = (image.getAttribute(name) || '').trim();
          if(altSrc && !altSrc.includes(' ')) {
            image.removeAttribute(name);
            image.setAttribute('src', altSrc);
            break;
          }
        }
      }
    }
  }
};
