// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

// Requires: /lib/parse-srcset.js
// Requires: /src/db.js
// Requires: /src/net.js
// Requires: /src/resolve-urls.js
// Requires: /src/utils.js

(function(exports) {

'use strict';

function pollFeeds() {
  console.log('Polling feeds');

  if(!navigator.onLine) {
    console.debug('Offline');
    return;
  }

  chrome.permissions.contains({permissions: ['idle']}, onCheckIdlePermission);
}

const IDLE_PERIOD = 60 * 5; // 5 minutes
function onCheckIdlePermission(permitted) {
  if(permitted) {
    chrome.idle.queryState(IDLE_PERIOD, onQueryIdleState);
  } else {
    db.open(iterateFeeds);
  }
}

function onQueryIdleState(state) {
  if(state === 'locked' || state === 'idle') {
    db.open(iterateFeeds);
  } else {
    console.debug('Not idle');
    onPollComplete();
  }
}

function iterateFeeds(event) {
  if(event.type === 'success') {
    const connection = event.target.result;
    db.forEachFeed(connection, fetchFeed.bind(null, connection), false,
      onPollComplete);
  } else {
    console.debug(event);
    onPollComplete();
  }
}

function fetchFeed(connection, feed) {
  const timeout = 10 * 1000;
  net.fetchFeed(feed.url, timeout, onFetchFeed.bind(null, connection, feed));
}

function onFetchFeed(connection, feed, event, remoteFeed) {
  if(event) {
    console.dir(event);
  } else {
    // TODO: if we are cleaning up the properties in db.storeFeed,
    // are we properly cascading those cleaned properties to the entries?
    db.storeFeed(connection, feed, remoteFeed,
      onStoreFeed.bind(null, connection, feed, remoteFeed));
  }
}

function onStoreFeed(connection, feed, remoteFeed, _) {
  async.forEach(remoteFeed.entries,
    onFindEntryByLink.bind(null, connection, feed),
    onEntriesUpdated.bind(null, connection));
}

function onEntriesUpdated(connection) {
  utils.updateBadge(connection);
}

function onFindEntryByLink(connection, feed, entry, callback) {
  db.findEntryByLink(connection, entry.link,
    onFindEntry.bind(null, connection, feed, entry, callback));
}

function onFindEntry(connection, feed, entry, callback, event) {
  const localEntry = event.target.result;
  if(localEntry) {
    callback();
  } else {
    const timeout = 20 * 1000;
    augmentEntryContent(entry, timeout, onAugment);
  }

  function onAugment(event) {
    cascadeFeedProperties(feed, entry);
    db.storeEntry(connection, entry, callback);
  }
}

function cascadeFeedProperties(feed, entry) {
  entry.feed = feed.id;

  // Denormalize now to avoid doing the lookup on render
  entry.feedLink = feed.link;
  entry.feedTitle = feed.title;

  // Use the feed's date for undated entries
  if(!entry.pubdate && feed.date) {
    entry.pubdate = feed.date;
  }
}

function onPollComplete() {
  console.log('Polling completed');
  localStorage.LAST_POLL_DATE_MS = String(Date.now());
  utils.showNotification('Updated articles');
}

function augmentEntryContent(entry, timeout, callback) {
  net.fetchHTML(entry.link, timeout, onFetchHTML.bind(null, entry, callback));
}

function onFetchHTML(entry, callback, error, document, responseURL) {

  if(error) {
    console.debug(error);
    callback();
    return;
  }

  if(responseURL !== entry.link) {
    console.debug('Response URL changed from %s to %s', entry.link,
      responseURL);
  }

  transformLazyImages(document);
  resolveURLs(document, responseURL);

  setImageDimensions(document, onSetImageDimensions.bind(null, entry, document,
    callback));
}

function onSetImageDimensions(entry, document, callback) {
  // TODO: is this right? the innerHTML of the documentElement?
  // Do I actually want outerHTML?
  const content = document.documentElement.innerHTML;
  if(content) {
    entry.content = content;
  }
  callback();
}

function setImageDimensions(document, callback) {
  const images = document.getElementsByTagName('img');
  const fetchables = Array.prototype.filter.call(images, shouldFetchImage);
  async.forEach(fetchables, fetchImage, callback);
}

function shouldFetchImage(image) {
  let url = image.getAttribute('src') || '';
  url = url.trim();
  return url && !utils.isObjectURL(url) && !image.width;
}

function fetchImage(image, callback) {
  const url = image.getAttribute('src');
  const proxy = document.createElement('img');
  proxy.onload = function(event) {
    onFetchImage(image, callback, event);
  };
  proxy.onerror = function(event) {
    onFetchImage(image, callback, event);
  };
  proxy.src = url;
}

function onFetchImage(image, callback, event) {
  if(event.type === 'load') {
    const proxy = event.target;
    image.width = proxy.width;
    image.height = proxy.height;
  } else {
    console.debug('Error: Failed to fetch image', image.getAttribute('src'));
  }
  callback();
}

function transformLazyImages(document) {
  const images = document.querySelectorAll('img');
  const numImages = images.length;
  for(let i = 0; i < numImages; i++) {
    transformLazyImage(images[i]);
  }
}

function transformLazyImage(image) {
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
  // this needs to be handled instead by the srcset handler
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
}

exports.pollFeeds = pollFeeds;
exports.setImageDimensions = setImageDimensions;

} (this));
