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

    // Async request the next feed, without waiting.
    cursor.continue();

    // Update the feed, starting with a fetch
    const feed = cursor.value;
    const timeout = 10 * 1000;
    const onFetchFeedBound = FeedPoller.onFetchFeed.bind(null, pollContext,
      feed);
    const excludeEntries = false;
    fetchFeed(feed.url, timeout, excludeEntries, onFetchFeedBound);
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

  const onPutFeedBound = FeedPoller.onPutFeed.bind(null, pollContext,
    remoteFeed.entries);
  putFeed(pollContext.connection, localFeed, remoteFeed, onPutFeedBound);
};

FeedPoller.onPutFeed = function(pollContext, entries, feed, putEvent) {

  if(putEvent.type !== 'success') {
    console.error(putEvent);
    pollContext.pendingFeedsCount--;
    FeedPoller.onMaybePollCompleted(pollContext);
    return;
  }


  const numEntries = entries ? entries.length : 0;
  if(!numEntries) {
    pollContext.pendingFeedsCount--;
    FeedPoller.onMaybePollCompleted(pollContext);
    return;
  }

  // TODO: normalize entry link URLs before comparing them

  const distinctLinks = {};
  let entriesProcessed = 0;
  for(let i = 0, entry, linkURLString; i < numEntries; i++) {
    entry = entries[i];
    linkURLString = entry.link;
    if(linkURLString) {
      linkURLString = utils.url.rewrite(linkURLString);
      if(linkURLString in distinctLinks) {
        onEntryProcessed();
      } else {
        distinctLinks[linkURLString] = 1;
        FeedPoller.processEntry(pollContext, feed, entry, onEntryProcessed);
      }
    } else {
      onEntryProcessed();
    }
  }

  function onEntryProcessed() {
    entriesProcessed++;
    if(entriesProcessed === numEntries) {
      pollContext.pendingFeedsCount--;
      FeedPoller.onMaybePollCompleted(pollContext);
      utils.updateBadgeText(pollContext.connection);
    }
  }
};

// TODO: link URLs should be normalized and the normalized url should be
// compared. This should not be using the raw link url.
// TODO: this needs to consider both the input url and the post-redirect
// url. Both may map to the same resource. I should be checking both
// urls somehow. I have not quite figured out how I want to do this
// Maybe entries should store a linkURLs array, and then I should have
// multi-entry index on it? That way I could do the lookup of an entry
// using a single request?
FeedPoller.processEntry = function(pollContext, feed, entry, callback) {

  // Prep the entry for storage
  entry.feed = feed.id;
  entry.feedLink = feed.link;
  entry.feedTitle = feed.title;
  // TODO: rename pubdate to datePublished
  // TODO: use Date objects
  // TODO: rename feed date to something clearer
  if(!entry.pubdate && feed.date) {
    entry.pubdate = feed.date;
  }

  findExistingEntry();

  function findExistingEntry() {
    const connection = pollContext.connection;
    const transaction = connection.transaction('entry');
    const entryStore = transaction.objectStore('entry');
    const linkIndex = entryStore.index('link');
    const request = linkIndex.get(entry.link);
    request.onsuccess = findExistingEntryOnSuccess;
    request.onerror = findExistingEntryOnError;
  }

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

    // TODO: what is the desired behavior when encountering an invalid URL?
    // Isn't that in some sense an entry I don't want?
    let linkURL = null;
    try {
      linkURL = new URL(entry.link);
    } catch(exception) {
      console.debug(entry.link, exception);
      Entry.put(pollContext.connection, entry, callback);
      return;
    }

    if(FeedPoller.isNoFetchURL(linkURL)) {
      console.debug('Not fetching blacklisted entry link', linkURL);
      Entry.put(pollContext.connection, entry, callback);
      return;
    }

    const path = linkURL.pathname;
    if(path && path.length > 5 && /\.pdf$/i.test(path)) {
      console.debug('Not fetching pdf entry link', linkURL);
      Entry.put(pollContext.connection, entry, callback);
      return;
    }

    fetchEntry();
  }

  function fetchEntry() {
    const fetchTimeoutMillis = 20 * 1000;
    const fetchRequest = new XMLHttpRequest();
    fetchRequest.timeout = fetchTimeoutMillis;
    fetchRequest.ontimeout = onFetchError;
    fetchRequest.onerror = onFetchError;
    fetchRequest.onabort = onFetchError;
    fetchRequest.onload = onFetchSuccess;
    const isAsync = true;
    fetchRequest.open('GET', entry.link, isAsync);
    fetchRequest.responseType = 'document';
    fetchRequest.send();
  }

  function onFetchError(event) {
    Entry.put(pollContext.connection, entry, callback);
  }

  function onFetchSuccess(event) {
    const fetchRequest = event.target;
    const document = fetchRequest.responseXML;

    // This happens with non-html content types like pdf
    if(!document) {
      Entry.put(pollContext.connection, entry, callback);
      return;
    }

    // TODO: if document is defined, can documentElement ever be undefined?
    if(!document.documentElement) {
      console.debug('Undefined document element for', entry.link);
      Entry.put(pollContext.connection, entry, callback);
      return;
    }

    // TODO: eventually do something with this. The url may have changed
    // because of redirects. This definitely happens.
    // Tentatively I am not logging this while I work on other things
    // because it floods the log
    //const responseURLString = fetchRequest.responseURL;
    //if(responseURLString !== entry.link) {
      // console.debug('Response URL changed from %s to %s', remoteEntry.link,
      //  responseURLString);
    //}

    // TODO: move URLResolver back into poll.js, this is the only place
    // it is called, and it really isn't a general purpose library.

    FeedPoller.transformLazilyLoadedImages(document);
    FeedPoller.filterSourcelessImages(document);
    URLResolver.resolveURLsInDocument(document, fetchRequest.responseURL);
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

    Entry.put(pollContext.connection, entry, callback);
  }
};

// TODO: I am not sure if 'startsWith' is the appropriate condition. Maybe
// I want to consider parts of the url.
FeedPoller.isNoFetchURL = function(url) {

  if(Object.prototype.toString.call(url) !== '[object URL]') {
    return false;
  }

  const blacklist = [
    'https://productforums.google.com',
    'https://groups.google.com'
  ];

  const query = url.href.toLowerCase();

  for(let i = 0, len = blacklist.length, origin; i < len; i++) {
    origin = blacklist[i];
    if(query.startsWith(origin)) {
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

    if(utils.url.isObjectURLString(urlString)) {
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
      console.debug('Removing sourcless image', image.outerHTML);
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
