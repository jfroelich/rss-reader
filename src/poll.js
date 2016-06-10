// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

// TODO: if possible look into having entries also be fetched async with
// feeds, so that everything is happening concurrently. It might be that
// way now but I have not thought it through and feel like I might be
// blocking somewhere for not a good reason

const FeedPoller = {};

FeedPoller.start = function() {
  console.log('Starting poll ...');

  // This is a shared object used by various async functions
  const pollContext = {
    'pendingFeedsCount': 0,
    'connection': null
  };

  // Check if we are online
  if('onLine' in navigator && !navigator.onLine) {
    console.log('Polling canceled because offline');
    FeedPoller.onComplete(pollContext);
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
        FeedPoller.onComplete(pollContext);
      }
    } else {
      db.open(onOpenDatabase);
    }
  }

  function onOpenDatabase(event) {
    if(event.type !== 'success') {
      console.debug(event);
      FeedPoller.onComplete(pollContext);
      return;
    }

    pollContext.connection = event.target.result;
    FeedPoller.iterateFeeds(pollContext);
  }
};

// Iterate over the feeds in the database, and update each feed.
// TODO: react appropriately to request error?

// TODO: ok so this problem with this approach is that it is partially blocking
// i think? Maybe i should be loading the feeds into an array first? Or
// maybe not. I think all the requests are still concurrent?

FeedPoller.iterateFeeds = function(pollContext) {
  const connection = pollContext.connection;
  const iterateFeedsTransaction = connection.transaction('feed');
  const feedStore = iterateFeedsTransaction.objectStore('feed');
  const iterateFeedsRequest = feedStore.openCursor();
  iterateFeedsRequest.onsuccess = onSuccess;

  function onSuccess(event) {
    const request = event.target;
    const cursor = request.result;

    if(!cursor) {
      FeedPoller.onMaybePollCompleted(pollContext);
      return;
    }

    // Increment the counter immediately to signal that a feed is now
    // undergoing an update and that there is at least one update pending
    pollContext.pendingFeedsCount++;

    const feed = cursor.value;
    const timeout = 10 * 1000;
    const onFetchFeedBound = FeedPoller.onFetchFeed.bind(null, pollContext,
      feed);
    fetchFeed(feed.url, timeout, onFetchFeedBound);
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

  // If there was a problem fetching the feed, then we are done processing
  // the feed.
  if(fetchEvent.type !== 'load') {
    console.dir(fetchEvent);
    pollContext.pendingFeedsCount--;
    FeedPoller.onMaybePollCompleted(pollContext);
    return;
  }

  const remoteFeed = fetchEvent.feed;

  // TODO: I am not yet using responseURL but I plan to use it. Something about
  // how I should be detecting if the feed url is
  // a redirect. I should only be using the post-redirect URL I think? But
  // is that solved as subscribe time as opposed to here? Although any check
  // for update means that after subscribe the source author could have
  // added a redirect, so we always need to continue to check for it every
  // time.
  const responseURL = fetchEvent.responseURLString;

  // TODO: check last modified date of the remote xml file to avoid
  // pointless updates? in order to do this, I would maybe have to get it from
  // the response headers, which means I would need to expose that somehow
  // via the callback from fetchFeed.

  // After fetching the feed, do some immediate cleanup of the feed's
  // properties as it pertains to this polling context

  let entries = remoteFeed.entries || [];

  // Removes entries without a link value
  entries = entries.filter(function(entry) {
    return entry.link;
  });

  // Rewrite entry link urls
  for(let i = 0, len = entries.length; i < len; i++) {
    entries[i].link = utils.url.rewrite(entries[i].link);
  }

  // Remove duplicate entries by link
  const expandedEntries = entries.map(function(entry) {
    return [entry.link, entry];
  });
  const distinctEntriesMap = new Map(expandedEntries);
  entries = Array.from(distinctEntriesMap.values());

  // Now store the updated feed
  const onPutFeedBound = FeedPoller.onPutFeed.bind(null, pollContext, entries);
  const connection = pollContext.connection;
  putFeed(connection, localFeed, remoteFeed, onPutFeedBound);
};

FeedPoller.onPutFeed = function(pollContext, entries, feed, putEvent) {
  const numEntries = entries.length;

  // If the feed has no entries, then we are done processing the feed
  if(!numEntries) {
    pollContext.pendingFeedsCount--;
    FeedPoller.onMaybePollCompleted(pollContext);
    utils.updateBadgeText(pollContext.connection);
    return;
  }

  // Otherwise, process the feed's entries concurrently
  // TODO: what if instead of using a counter and a test, I used something
  // like a stack or queue where I pop as each step of iteration ends, and
  // then the condition is just whether the collection is empty?

  for(let i = 0; i < numEntries; i++) {
    FeedPoller.processEntry(pollContext, feed, entries[i], onEntryProcessed);
  }

  // This is a shared callback used when processing each of the feed's entries,
  // and which ever one finishes last triggers its end condition that then
  // means we are done processing the feed.
  let entriesProcessed = 0;
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

    // If a similar entry was found, then we are done
    if(localEntry) {
      callback();
      return;
    }

    if(FeedPoller.shouldNotFetchEntry(entry)) {
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
    fetchRequest.open('GET', entry.link, true);

    // TODO: what is the default behavior of XMLHttpRequest? If responseType
    // defaults to document and by default fetches HTML/XML, do we even need to
    // specify the type? or does specifying the type trigger an error if
    // the type is not valid, which is what I want
    fetchRequest.responseType = 'document';
    fetchRequest.send();
  }

  function onFetchError(event) {
    // If there was a problem fetching the entry, and it should be
    // fetched, then I guess I don't want to store it, so just skip it.
    // TODO: not sure. Maybe I should still be storing it? In fact I think
    // I should be, and I am not sure why I am not doing this here. This
    // error just means we can't augment the content, it doesn't mean the
    // entry should be ignored.
    console.debug(event);
    callback();
  }

  function onFetchSuccess(event) {
    const fetchRequest = event.target;
    const document = fetchRequest.responseXML;

    // Document can be undefined in various cases such as when fetching a PDF
    // By exiting here, I am not storing the entry, even though I technically
    // could have. Maybe this is wrong?
    // TODO: I think maybe this should still store the entry, just without
    // augmented content.
    if(!document) {
      callback();
      return;
    }

    // TODO: if document is defined, can documentElement ever be undefined?
    // Maybe this test is redundant.
    if(!document.documentElement) {
      console.debug('Undefined document element for', entry.link);
      callback();
      return;
    }

    // TODO: eventually do something with this. The url may have changed
    // because of redirects. This definitely happens.
    const responseURLString = fetchRequest.responseURL;
    if(responseURLString !== entry.link) {
      // Tentatively I am not logging this while I work on other things
      // because it floods the log
      // console.debug('Response URL changed from %s to %s', remoteEntry.link,
      //  responseURLString);
    }

    FeedPoller.transformLazilyLoadedImages(document);
    FeedPoller.filterSourcelessImages(document);
    // TODO: move URLResolver back into poll.js, this is the only place
    // it is called, and it really isn't a general purpose library.
    URLResolver.resolveURLsInDocument(document, responseURLString);
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

// TODO: break apart into two functions, don't do the PDF check here. Instead
// this concept should be composed in the calling context.
FeedPoller.shouldNotFetchEntry = function(entry) {
  const linkURLString = entry.link;
  const lowercaseLinkURLString = linkURLString.toLowerCase();

  const blacklist = [
    'https://productforums.google.com',
    'https://groups.google.com'
  ];

  for(let i = 0, len = blacklist.length, origin; i < len; i++) {
    origin = blacklist[i];
    if(lowercaseLinkURLString.startsWith(origin)) {
      console.debug('Excluding', linkURLString);
      return true;
    }
  }

  // This should never throw given the assumption of a valid absolute url
  // as input, but I don't want the exception to bubble. I would almost
  // prefer this was done by the caller and this function just accepted
  // a URL object as input. Or, what would really be ideal, is if entry.link
  // was a URL object.
  let linkURL = null;
  try {
    linkURL = new URL(linkURLString);
  } catch(exception) {
    console.debug(linkURLString, exception);
    return false;
  }

  if(FeedPoller.isPDFURL(linkURL)) {
    console.debug('Excluding', linkURL);
    return true;
  }

  // Default to always fetching
  return false;
};

// Returns true when the URL's path ends with ".pdf"
// @param url {URL}
FeedPoller.isPDFURL = function(url) {
  // Minimum 5 characters for 'a.pdf', the length test reduces the num of
  // calls to the regexp
  const path = url.pathname;
  return path && path.length > 5 && /\.pdf$/i.test(path);
};

FeedPoller.getLiveDocument = function() {
  return document;
};

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
    }

    onImageProcessed(imageElement);
  }

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
      // because the browser may tolerate sloppy URLs that contain inner spaces.
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
