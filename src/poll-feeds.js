// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

// TODO: move the url stuff into a resolver module, this has become
// too monolithic
// TODO: resolve xlink type simple (on any attribute)

// Requires: /lib/parse-srcset.js
// Requires: /src/db.js
// Requires: /src/net.js
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
  resolveDocumentURLs(document, responseURL);
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

const ELEMENT_URL_ATTRIBUTE_MAP = new Map([
  ['a', 'href'],
  ['area', 'href'],
  ['audio', 'src'],
  ['blockquote', 'cite'],
  ['del', 'cite'],
  ['embed', 'src'],
  ['iframe', 'src'],
  ['form', 'action'],
  ['img', 'src'],
  ['ins', 'cite'],
  ['link', 'href'],
  ['object', 'data'],
  ['q', 'cite'],
  ['script', 'src'],
  ['source', 'src'],
  ['track', 'src'],
  ['video', 'src']
]);

const RESOLVE_SELECTOR = function() {
  let keys = [];
  ELEMENT_URL_ATTRIBUTE_MAP.forEach(function(value, key) {
    keys.push(key + '[' + value +']');
  });
  return keys.join(',');
}();

function resolveDocumentURLs(document, baseURL) {
  const forEach = Array.prototype.forEach;
  const baseElementList = document.querySelectorAll('base');
  const removeBaseElement = function(baseElement) {
    baseElement.remove();
  };
  forEach.call(baseElementList, removeBaseElement);

  const getNameOfAttributeWithURL = function(element) {
    return ELEMENT_URL_ATTRIBUTE_MAP.get(element.localName);
  };

  const resolvables = document.querySelectorAll(RESOLVE_SELECTOR);
  forEach.call(resolvables, function(element) {
    const attribute = getNameOfAttributeWithURL(element);
    const url = element.getAttribute(attribute).trim();
    const resolved = utils.resolveURL(baseURL, url);
    if(resolved && resolved !== url) {
      element.setAttribute(attribute, resolved);
    }

    if((element.localName === 'img' || element.localName === 'source') &&
      element.hasAttribute('srcset')) {
      resolveImageSrcSet(baseURL, element);
    }
  });
}

// Access an image element's srcset attribute, parses it into an array of
// descriptors, resolves the url for each descriptor, and then composes the
// descriptors array back into a string and modifies the element
function resolveImageSrcSet(baseURL, image) {

  const source = image.getAttribute('srcset');
  let descriptors = parseSrcset(source) || [];
  let numURLsChanged = 0;
  let resolvedDescriptors = descriptors.map(function(descriptor) {
    const resolvedURL = utils.resolveURL(baseURL, descriptor.url);
    let newURL = descriptor.url;
    if(resolvedURL && resolvedURL !== descriptor.url) {
      newURL = resolvedURL;
      numURLsChanged++;
    }

    return {
      url: newURL, d: descriptor.d, w: descriptor.w, h: descriptor.h
    };
  });

  if(numURLsChanged === 0) {
    return;
  }

  const newSource = serializeSrcSet(resolvedDescriptors);
  console.debug('Changing srcset %s to %s', source, newSource);
  image.setAttribute('srcset', newSource);
}

// Returns a string representing serialized descriptors, which is a suitable
// srcset attribute value for an element
// TODO: THIS IS INCOMPLETE, because I do not yet include the other dimensions
// back into the string, and I am getting image errors in the output
// TODO: support d,w,h
// TODO: do a no-op if the urls were already absolute
function serializeSrcSet(descriptors) {

  const resolvedDescriptors = [];
  const numDescriptors = descriptors.length;

  for(let i = 0, descriptor, newString; i < numDescriptors; i++) {
    descriptor = descriptors[i];
    newString = descriptor.url;

    if(descriptor.d) {
      // newString += ' ' + descriptor.d;
    }

    if(descriptor.w) {
      // newString += ' ' + descriptor.w + 'w';
    }

    if(descriptor.h) {
      // newString += ' ' + descriptor.h + 'h';
    }

    resolvedDescriptors.push(newString);
  }

  // i believe a comma is what joins? have not researched
  return resolvedDescriptors.join(', ');
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
exports.resolveDocumentURLs = resolveDocumentURLs;
exports.setImageDimensions = setImageDimensions;

} (this));
