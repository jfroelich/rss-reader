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

// TODO: rather than check if event is defined or not, check if event
// has the proper type (e.g. type === 'load') or whatever it is
// Right now, event is only defined if there was an error. In the future,
// I think event should always be defined, it is just that its type is
// 'load' or whatever for successful fetch.
// TODO: if I am always passing back event, I can probably get
// responseURL from the event itself, so I don't need to pass back
// responseURL as an explicit parameter, I can just use
// event.target.responseURL
// TODO: and it shouldn't be called errorEvent then, it should just be
// an event
// TODO: I am not even sure how much work fetchFeed should be doing on
// its own, implicitly. E.g. should it just be fetchXML and then all the
// post processing happens explicitly, here in the calling context?
// TODO: just a mental note, I am not yet using responseURL but I planned
// to use it. Something about how I should be detecting if the feed url is
// a redirect. I should only be using the post-redirect URL I think? But
// is that solved as subscribe time as opposed to here? Although any check
// for update means that after subscribe the source author could have
// added a redirect, so we always need to continue to check for it every
// time.

// TODO: fetchFeed should use an event object and pass back a custom
// event object instead of multiple variables. I should just set
// the properties of that custom event object within fetchFeed. This will
// greatly simplify the number of variables negotiated, which reduces the
// number of parameters per function, and provides some abstraction and
// encapsulation. Also, it stays pretty lightweight.

FeedPoller.onFetchFeed = function(pollContext, localFeed,
  fetchErrorEvent, remoteFeed, responseURL) {

  // Exit early if an error occurred while fetching. The event is only
  // defined if there was a fetch error.
  if(fetchErrorEvent) {
    console.dir(fetchErrorEvent);
    return;
  }

  // TODO: check last modified date of the remote xml file to avoid
  // pointless updates?

  const entries = remoteFeed.entries || [];

  const onPutFeedBound = FeedPoller.onPutFeed.bind(null, pollContext, entries);
  const connection = pollContext.connection;
  putFeed(connection, localFeed, remoteFeed, onPutFeedBound);
};


FeedPoller.onPutFeed = function(pollContext, entries, feed, putEvent) {
  let entriesProcessed = 0;
  const numEntries = entries.length;

  if(!numEntries) {
    pollContext.pendingFeedsCount--;
    FeedPoller.onMaybePollCompleted(pollContext);
    utils.updateBadgeText(pollContext.connection);
    return;
  }

  for(let i = 0; i < numEntries; i++) {
    FeedPoller.processEntry(pollContext, feed, entries[i], onEntryProcessed);
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

// Processing the entry starts with checking if the entry already exists.
// I do this before fetching the full text of the entry in order to minimize
// the number of http requests and the impact the app places on 3rd parties.
// TODO: link URLs should be normalized and the normalized url should be
// compared. This should not be using the raw link url.
// TODO: this needs to consider both the input url and the post-redirect
// url. Both may map to the same resource. I should be checking both
// urls somehow. I have not quite figured out how I want to do this
// Maybe entries should store a linkURLs array, and then I should have
// multi-entry index on it? That way I could do the lookup of an entry
// using a single request?
FeedPoller.processEntry = function(pollContext, feed, entry, callback) {

  const transaction = pollContext.connection.transaction('entry');
  const entryStore = transaction.objectStore('entry');
  const linkIndex = entryStore.index('link');
  const getLinkRequest = linkIndex.get(entry.link);
  getLinkRequest.onsuccess = getLinkRequestOnSuccess;
  getLinkRequest.onerror = getLinkRequestOnError;

  function getLinkRequestOnError(event) {
    console.debug(event);
    callback();
  }

  function getLinkRequestOnSuccess(event) {
    const localEntry = event.target.result;
    if(localEntry) {
      callback();
      return;
    }

    // TODO: check if we should not be considering its full text and if
    // so just exit early (e.g. don't augment google forums urls)

    const fetchTimeoutMillis = 20 * 1000;
    const fetchRequest = new XMLHttpRequest();
    fetchRequest.timeout = fetchTimeoutMillis;
    fetchRequest.ontimeout = onFetchError;
    fetchRequest.onerror = onFetchError;
    fetchRequest.onabort = onFetchError;
    fetchRequest.onload = onFetchSuccess;
    fetchRequest.open('GET', entry.link, true);

    // TODO: what is the default behavior of XMLHttpRequest? If responseType
    // defaults to document and by default fetches HTML, do we even need to
    // specify the type? or does specifying the type trigger an error if
    // the type is not valid, which is what I want
    fetchRequest.responseType = 'document';
    fetchRequest.send();
  }

  function onFetchError(event) {
    console.debug(event);
    callback();
  }

  function onFetchSuccess(event) {
    const fetchRequest = event.target;
    const document = fetchRequest.responseXML;

    // Document can be undefined in various cases such as when fetching a PDF
    if(!document) {
      callback();
      return;
    }

    // TODO: if document is defined, can documentElement ever be undefined?
    if(!document.documentElement) {
      callback();
      return;
    }

    // TODO: eventually do something with this. The url may have changed
    // because of redirects. This definitely happens.
    const responseURLString = fetchRequest.responseURL;
    if(responseURLString !== entry.link) {
      // NOTE: tentatively I am not logging this while I work on other things
      // because it floods the log
      // console.debug('Response URL changed from %s to %s', remoteEntry.link,
      //  responseURLString);
    }

    FeedPoller.filterTrackingImages(document);
    FeedPoller.transformLazilyLoadedImages(document);
    URLResolver.resolveURLsInDocument(document, responseURLString);
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

    entry.feed = feed.id;
    entry.feedLink = feed.link;
    entry.feedTitle = feed.title;
    if(!entry.pubdate && feed.date) {
      entry.pubdate = feed.date;
    }

    Entry.put(pollContext.connection, entry, callback);
  }
};

FeedPoller.getHostDocument = function() {
  return document;
};

FeedPoller.fetchImageDimensions = function(document, callback) {
  const stats = {
    'numProcessed': 0,
    'numFetched': 0
  };

  const rootElement = document.body || document.documentElement;
  if(!rootElement) {
    callback(document, stats);
    return;
  }

  const imageNodeList = rootElement.getElementsByTagName('img');
  const numImages = imageNodeList.length;
  if(!numImages) {
    callback(document, stats);
    return;
  }

  // TODO: not sure about the isObjectURL condition. I suppose an object
  // url could still not have its width and height attributes set. But
  // it would have its width and height properties set because those are set
  // at the time the html is parsed? I want to be sure that all images have
  // width and height attributes set. I need to look into this more.
  // Maybe calamine could check both attributes and properties, because of
  // the case of object urls without attributes but with properties?
  // Maybe for object urls I could just separately process them and
  // manually set the attributes for them?

  for(let i = 0, imageElement, urlString; i < numImages; i++) {
    imageElement = imageNodeList[i];
    urlString = imageElement.getAttribute('src') || '';
    urlString = urlString.trim();
    if(urlString && !imageElement.hasAttribute('width') &&
      !utils.url.isObjectURLString(urlString)) {
      fetchImage(imageElement);
    } else {
      onImageProcessed(imageElement);
    }
  }

  // Proxy is intentionally created within the local document
  // context because we know it is live. Chrome will eagerly fetch upon
  // changing the image element's src property because it is live.
  function fetchImage(imageElement) {
    const sourceURLString = imageElement.getAttribute('src');
    const hostDocument = FeedPoller.getHostDocument();
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
      // Set attributes so that the values persist when serialized
      imageElement.setAttribute('width', proxyImageElement.width);
      imageElement.setAttribute('height', proxyImageElement.height);
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

// Remove images that merely serve to register http requests for website
// statistics
// TODO: I am not seeing any of the last 4 urls here being filtered. Maybe
// I am looking for the wrong thing? I have not seen these occur even
// once? Are they just script origins?
FeedPoller.filterTrackingImages = function(document) {

  const rootElement = document.body || document.documentElement;
  if(!rootElement) {
    return;
  }

  const SELECTOR = [
    'img[src^="http://b.scorecardresearch.com"]',
    'img[src^="https://b.scorecardresearch.com"]',
    'img[src^="http://pagead2.googlesyndication.com"]',
    'img[src^="https://pagead2.googlesyndication.com"]',
    'img[src^="http://pubads.g.doubleclick.net"]',
    'img[src^="https://pubads.g.doubleclick.net"]'
  ].join(',');
  const imageNodeList = rootElement.querySelectorAll(SELECTOR);
  const listLength = imageNodeList.length;
  for(let i = 0, imageElement; i < listLength; i++) {
    imageElement = imageNodeList[i];
    // Tentatively not logging this while I work on other things, it is
    // causing a lot of spam in the log
    // console.debug('Removing tracker:', imageElement.outerHTML);
    imageElement.remove();
  }
};

// Modify the src values of images that appear to be lazily loaded.
// TODO: maybe skip an image if image.closest('picture') ?
FeedPoller.transformLazilyLoadedImages = function(document) {
  const rootElement = document.body || document.documentElement;
  if(!rootElement) {
    return;
  }

  const imageNodeList = rootElement.querySelectorAll('img');
  const listLength = imageNodeList.length;
  for(let i = 0; i < listLength; i++) {
    FeedPoller.transformLazilyLoadedImage(imageNodeList[i]);
  }
};

// TODO: reduce the DRYness of this function
// TODO: support this case better. There is a problem here because
// the tiny image filter is picking this up and removing it.
// <img data-thumb="url" data-full-size-image="url" data-lar
// ge-size-image="url" data-trigger-notification="1" data-scalable="fa
// lse" alt="" data-src="url" data-tc-lazyload="deferred" src="url" width=
// "1" height="1">
FeedPoller.transformLazilyLoadedImage = function(image) {
  if(!image.hasAttribute('src') && image.hasAttribute('load-src')) {
    image.setAttribute('src', image.getAttribute('load-src'));
    return;
  }

  if(image.hasAttribute('data-src') &&
    image.classList.contains('lazy-image')) {
    image.setAttribute('src', image.getAttribute('data-src'));
    return;
  }

  if(!image.hasAttribute('src') && image.hasAttribute('data-src')) {
    image.setAttribute('src', image.getAttribute('data-src'));
    return;
  }

  // TODO: responsive design conflicts with the approach this takes,
  // this needs to be handled instead by the srcset handler?
  if(!image.hasAttribute('src') &&
    image.hasAttribute('data-original-desktop')) {
    image.setAttribute('src', image.getAttribute('data-original-desktop'));
    return;
  }

  if(!image.hasAttribute('src') && image.hasAttribute('data-baseurl')) {
    image.setAttribute('src', image.getAttribute('data-baseurl'));
    return;
  }

  if(!image.hasAttribute('src') && image.hasAttribute('data-lazy')) {
    image.setAttribute('src', image.getAttribute('data-lazy'));
    return;
  }

  if(!image.hasAttribute('src') && image.hasAttribute('data-img-src')) {
    image.setAttribute('src', image.getAttribute('data-img-src'));
    return;
  }

  if(!image.hasAttribute('src') && image.hasAttribute('data-original')) {
    image.setAttribute('src', image.getAttribute('data-original'));
    return;
  }

  if(!image.hasAttribute('src') && image.hasAttribute('data-adaptive-img')) {
    image.setAttribute('src', image.getAttribute('data-adaptive-img'));
    return;
  }
};
