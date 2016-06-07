// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

const FeedPoller = {};

FeedPoller.start = function() {
  console.log('Starting poll ...');

  // This is a shared object used by various async functions
  const pollContext = {
    'pendingFeeds': 0,
    'connection': null
  };

  // Check if we are online
  if('onLine' in navigator && !navigator.onLine) {
    console.debug('Polling canceled because offline');
    FeedPoller.onComplete(pollContext);
    return;
  }

  if(!localStorage.ONLY_POLL_IF_IDLE) {
    // Skip the idle check and go straight to opening the database
    db.open(onOpenDatabase);
  } else {
    // Check if we have been idling for a minute
    const IDLE_PERIOD_SECONDS = 60;
    chrome.idle.queryState(IDLE_PERIOD_SECONDS, onQueryIdleState);
  }

  function onQueryIdleState(state) {
    if(localStorage.ONLY_POLL_IF_IDLE) {
      if(state === 'locked' || state === 'idle') {
        db.open(onOpenDatabase);
      } else {
        console.debug('Polling canceled because not idle');
        FeedPoller.onComplete(pollContext);
      }
    } else {
      db.open(onOpenDatabase);
    }
  }

  function onOpenDatabase(event) {
    // Exit early if there was a database connection error
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
  iterateFeedsRequest.onsuccess = FeedPoller.onGetNextFeed.bind(
    iterateFeedsRequest, pollContext);
};

// Processes the feed at the current cursor position and then advances the
// cursor.
FeedPoller.onGetNextFeed = function(pollContext, event) {
  const request = event.target;
  const cursor = request.result;

  if(!cursor) {
    FeedPoller.onMaybePollCompleted(pollContext);
    return;
  }

  // Increment the counter immediately to signal that a feed is now
  // undergoing an update and that there is at least one update pending
  pollContext.pendingFeeds++;

  const feed = cursor.value;
  const timeout = 10 * 1000;
  const onFetchFeedBound = FeedPoller.onFetchFeed.bind(null, pollContext,
    feed);
  fetchFeed(feed.url, timeout, onFetchFeedBound);
  cursor.continue();
};

FeedPoller.onMaybePollCompleted = function(pollContext) {
  // If there is still pending work we are not actually done
  if(pollContext.pendingFeeds) {
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
  errorEvent, remoteFeed, responseURL) {

  // Exit early if an error occurred while fetching. The event is only
  // defined if there was a fetch error.
  if(errorEvent) {
    console.debug('Error fetching:', localFeed.url);
    console.dir(errorEvent);
    return;
  }

  const onStoreFeedBound = FeedPoller.onStoreFeed.bind(null,
    pollContext, localFeed, remoteFeed);
  const connection = pollContext.connection;
  Feed.put(connection, localFeed, remoteFeed, onStoreFeedBound);
};


// TODO: if possible look into having entries also be fetched async with
// feeds, so that everything is happening concurrently. It might be that
// way now but I have not thought it through and feel like I might be
// blocking somewhere for not a good reason
FeedPoller.onStoreFeed = function(pollContext, localFeed, remoteFeed,
  putEvent) {

  const entries = remoteFeed.entries;
  const numEntries = entries ? entries.length : 0;

  // For each entry, check if it does not already exist in the database,
  // and if it does not, augment and store it
  // TODO: should this be using localFeed or remoteFeed? It is kind of
  // confusing actually why i am using one but not the other, or why I am even
  // keeping both around here and distinguishing between them.
  // TODO: what i should be doing is once I update the feed, I should be
  // getting whatever is the updated object back from Feed.put and then
  // just referencing and communicating that object.
  for(let i = 0, remoteEntry; i < numEntries; i++) {
    remoteEntry = entries[i];
    FeedPoller.processEntry(pollContext, localFeed, remoteEntry,
      onEntryProcessed);
  }

  let entriesProcessed = 0;
  function onEntryProcessed() {
    entriesProcessed++;

    // NOTE: we increment entriesProcessed even when there are no
    // entries, which is why I use >= instead of ===

    if(entriesProcessed >= numEntries) {
      // We finished processing the feed
      pollContext.pendingFeeds--;
      FeedPoller.onMaybePollCompleted(pollContext);

      // Update the number of unread entries
      utils.updateBadgeText(pollContext.connection);
    }
  }
};

FeedPoller.processEntry = function(pollContext, localFeed, remoteEntry,
  callback) {

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

  const transaction = pollContext.connection.transaction('entry');
  const entryStore = transaction.objectStore('entry');
  const linkIndex = entryStore.index('link');
  const getLinkRequest = linkIndex.get(remoteEntry.link);
  getLinkRequest.onsuccess = getLinkRequestOnSuccess;

  getLinkRequest.onerror = function(event) {
    console.debug(event);
    callback();
  };

  function getLinkRequestOnSuccess(event) {
    const localEntry = event.target.result;

    // Exit early if the entry exists
    if(localEntry) {
      callback();
      return;
    }

    // Otherwise, the entry does not exist. Fetch its full text.
    // TODO: check if we should not be considering its full text and if
    // so just exit early (e.g. don't augment google forums urls)

    const fetchTimeoutMillis = 20 * 1000;
    const fetchRequest = new XMLHttpRequest();
    fetchRequest.timeout = fetchTimeoutMillis;
    fetchRequest.ontimeout = onFetchError;
    fetchRequest.onerror = onFetchError;
    fetchRequest.onabort = onFetchError;
    fetchRequest.onload = onFetchSuccess;
    fetchRequest.open('GET', remoteEntry.link, true);

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

    if(!document) {
      console.debug('Undefined document for', remoteEntry.link);
      callback();
      return;
    }

    if(!document.documentElement) {
      console.debug('Undefined document element for', remoteEntry.link);
      callback();
      return;
    }

    // TODO: eventually do something with this. The url may have changed
    // because of redirects. This definitely happens.
    const responseURLString = fetchRequest.responseURL;
    if(responseURLString !== remoteEntry.link) {
      // NOTE: tentatively I am not logging this while I work on other things
      // because it floods the log
      // console.debug('Response URL changed from %s to %s', remoteEntry.link,
      //  responseURLString);
    }

    // Clean up and process the fetched document

    // TODO: if this is the sole calling context, move the functionality back
    // here?
    FeedPoller.filterTrackingImages(document);
    FeedPoller.transformLazilyLoadedImages(document);
    URLResolver.resolveURLsInDocument(document, responseURLString);

    // Ensure that image dimensions are set in the document
    // TODO: if this is the sole calling context, maybe move that code back
    // into here.
    ImageUtils.fetchDimensions(document, onSetImageDimensions.bind(null,
      document));
  }

  function onSetImageDimensions(remoteEntryDocument) {

    // Possibly replace the content property of the remoteEntry with the
    // fetched and cleaned full text.

    const documentElement = remoteEntryDocument.documentElement;
    if(documentElement) {
      const fullDocumentHTMLString = documentElement.outerHTML;
      if(fullDocumentHTMLString) {
        // Check for content length. This should reduce the number of empty
        // articles.
        // TODO: maybe I should be checking the content of body. In fact if
        // there is no body element, maybe this shouldn't even be replacing
        // entry.content at all. Maybe documentElement is the wrong thing
        // to consider. Maybe I want to check body but use the full content
        // of documentElement.
        // Also, maybe I want to use an substitute message.
        const trimmedFullDocumentHTMLString = fullDocumentHTMLString.trim();
        if(trimmedFullDocumentHTMLString) {
          // Now modify the remote entry
          remoteEntry.content = trimmedFullDocumentHTMLString;
        }
      }
    }

    // Prepare the entry for storage.
    // TODO: is it correct to use localFeed here? Or differentiate between
    // local and remote?

    // Link the entry to the feed
    // NOTE: this is one reason I need localFeed i suppose. however I could
    // still get this from the result of Feed.put
    remoteEntry.feed = localFeed.id;
    // Do some denormalization so that lookups do not need to be performed
    // when the entry is rendered.
    remoteEntry.feedLink = localFeed.link;
    remoteEntry.feedTitle = localFeed.title;

    // Use the feed's date for undated entries
    if(!remoteEntry.pubdate && localFeed.date) {
      remoteEntry.pubdate = localFeed.date;
    }

    // Store the entry, and pass along the callback so it will be called
    // when the entry is stored
    Entry.put(pollContext.connection, remoteEntry, callback);
  }
};

// Remove images that merely serve to register http requests for website
// statistics
FeedPoller.filterTrackingImages = function(document) {

  // TODO: I am not seeing any of the last 4 urls here being filtered. Maybe
  // I am looking for the wrong thing? I have not seen these occur even
  // once? Are they just script origins?

  const SELECTORS = [
    'img[src^="http://b.scorecardresearch.com"]',
    'img[src^="https://b.scorecardresearch.com"]',
    'img[src^="http://pagead2.googlesyndication.com"]',
    'img[src^="https://pagead2.googlesyndication.com"]',
    'img[src^="http://pubads.g.doubleclick.net"]',
    'img[src^="https://pubads.g.doubleclick.net"]'
  ];

  const SELECTOR = SELECTORS.join(',');

  // I only look for tracking images within the body, because I assume
  // that out-of-body information is removed separately in the domaid
  // functions.
  const rootElement = document.body || document.documentElement;
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
  const bodyElement = document.body;
  if(!bodyElement) {
    return;
  }

  const imageNodeList = bodyElement.querySelectorAll('img');
  const listLength = imageNodeList.length;
  for(let i = 0; i < listLength; i++) {
    FeedPoller.transformLazilyLoadedImage(imageNodeList[i]);
  }
};

// TODO: reduce the DRYness of this function
FeedPoller.transformLazilyLoadedImage = function(image) {

  // TODO: support this case better. There is a problem here because
  // the tiny image filter is picking this up and removing it.
  /*
<img data-thumb="url" data-full-size-image="url" data-lar
ge-size-image="url" data-trigger-notification="1" data-scalable="fa
lse" alt="" data-src="url" data-tc-lazyload="deferred" src="url" width=
"1" height="1">
  */

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
