// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

// Requires: /lib/parse-srcset.js
// Requires: /lib/URI.js
// Requires: /src/db.js
// Requires: /src/net.js
// Requires: /src/utils.js

const FeedPoll = {};

FeedPoll.pollFeeds = function() {
  'use strict';
  console.log('Polling feeds');

  if(!navigator.onLine) {
    console.debug('Polling canceled as offline');
    return;
  }

  chrome.permissions.contains({permissions: ['idle']},
    FeedPoll.onCheckIdlePermission);
};

FeedPoll.onCheckIdlePermission = function(permitted) {
  'use strict';

  const IDLE_PERIOD = 60 * 5; // 5 minutes
  if(permitted) {
    chrome.idle.queryState(IDLE_PERIOD,
      FeedPoll.onQueryIdleState);
  } else {
    db.open(FeedPoll.iterateFeeds);
  }
};

FeedPoll.onQueryIdleState = function(state) {
  'use strict';
  if(state === 'locked' || state === 'idle') {
    db.open(FeedPoll.iterateFeeds);
  } else {
    console.debug('Polling canceled as not idle');
    FeedPoll.onComplete();
  }
};

FeedPoll.iterateFeeds = function(event) {
  'use strict';

  if(event.type === 'success') {
    const connection = event.target.result;
    db.forEachFeed(connection, FeedPoll.fetchFeed.bind(null,
      connection), false, FeedPoll.onComplete);
  } else {
    console.debug(event);
    FeedPoll.onComplete();
  }
};

FeedPoll.fetchFeed = function(connection, feed) {
  'use strict';

  const timeout = 10 * 1000;
  net.fetchFeed(feed.url, timeout,
    FeedPoll.onFetchFeed.bind(null, connection, feed));
};

FeedPoll.onFetchFeed = function(connection, feed, event, remoteFeed) {
  'use strict';
  if(event) {
    console.dir(event);
  } else {
    // TODO: if we are cleaning up the properties in db.storeFeed,
    // are we properly cascading those cleaned properties to the entries?
    db.storeFeed(connection, feed, remoteFeed,
      FeedPoll.onPutFeed.bind(null, connection, feed, remoteFeed));
  }
};

FeedPoll.onPutFeed = function(connection, feed, remoteFeed, _) {
  'use strict';
  async.forEach(remoteFeed.entries,
    FeedPoll.findEntryByLink.bind(null, connection, feed),
    FeedPoll.onEntriesUpdated.bind(null, connection));
};

FeedPoll.onEntriesUpdated = function(connection) {
  'use strict';
  utils.updateBadge(connection);
};

FeedPoll.findEntryByLink = function(connection, feed, entry, callback) {
  'use strict';
  db.findEntryByLink(connection, entry.link,
    FeedPoll.onFindEntry.bind(null, connection, feed, entry, callback));
};

FeedPoll.onFindEntry = function(connection, feed, entry, callback, event) {
  'use strict';

  const localEntry = event.target.result;
  if(localEntry) {
    callback();
  } else {
    const timeout = 20 * 1000;
    FeedPoll.augmentEntryContent(entry, timeout, onAugment);
  }

  function onAugment(event) {
    FeedPoll.cascadeFeedProperties(feed, entry);
    db.storeEntry(connection, entry, callback);
  }
};

FeedPoll.cascadeFeedProperties = function(feed, entry) {
  'use strict';

  entry.feed = feed.id;

  // Denormalize now to avoid doing the lookup on render
  entry.feedLink = feed.link;
  entry.feedTitle = feed.title;

  // Use the feed's date for undated entries
  if(!entry.pubdate && feed.date) {
    entry.pubdate = feed.date;
  }
};

FeedPoll.onComplete = function() {
  console.log('Polling completed');
  localStorage.LAST_POLL_DATE_MS = String(Date.now());
  utils.showNotification('Updated articles');
};

FeedPoll.augmentEntryContent = function(entry, timeout, callback) {
  'use strict';
  net.fetchHTML(entry.link, timeout,
    FeedPoll.onFetchHTML.bind(null, entry, callback));
};

FeedPoll.onFetchHTML = function(entry, callback, error, document,
  responseURL) {
  'use strict';

  if(error) {
    console.debug(error);
    callback();
    return;
  }

  if(responseURL !== entry.link) {
    console.debug('Response URL changed from %s to %s',
      entry.link,
      responseURL);
  }

  FeedPoll.transformLazyImages(document);
  FeedPoll.resolveDocumentURLs(document, responseURL);
  FeedPoll.setImageDimensions(document,
    FeedPoll.onSetImageDimensions.bind(null, entry, document, callback));
};

FeedPoll.onSetImageDimensions = function(entry, document, callback) {
  'use strict';
  // TODO: is this right? the innerHTML of the documentElement?
  // Do I actually want outerHTML?
  const content = document.documentElement.innerHTML;
  if(content) {
    entry.content = content;
  }
  callback();
};

FeedPoll.setImageDimensions = function(document, callback) {
  'use strict';
  const images = document.getElementsByTagName('img');
  const fetchables = Array.prototype.filter.call(images,
    FeedPoll.shouldFetchImage);
  async.forEach(fetchables, FeedPoll.fetchImage, callback);
};

FeedPoll.shouldFetchImage = function(image) {
  'use strict';
  let url = image.getAttribute('src') || '';
  url = url.trim();
  return url && !utils.isObjectURL(url) && !image.width;
};

FeedPoll.fetchImage = function(image, callback) {
  'use strict';
  const url = image.getAttribute('src');
  const proxy = document.createElement('img');
  proxy.onload = function(event) {
    FeedPoll.onFetchImage(image, callback, event);
  };
  proxy.onerror = function(event) {
    FeedPoll.onFetchImage(image, callback, event);
  };
  proxy.src = url;
};

FeedPoll.onFetchImage = function(image, callback, event) {
  'use strict';
  if(event.type === 'load') {
    const proxy = event.target;
    image.width = proxy.width;
    image.height = proxy.height;
  } else {
    console.debug('Failed to fetch image', image.getAttribute('src') ||
      image.getAttribute('srcset'));
  }
  callback();
};

// A map of element names to attributes that contain urls
FeedPoll.ELEMENT_URL_ATTRIBUTE_MAP = new Map([
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

FeedPoll.RESOLVE_SELECTOR = function() {
  'use strict';
  let keys = [];
  FeedPoll.ELEMENT_URL_ATTRIBUTE_MAP.forEach(function(value, key) {
    keys.push(key + '[' + value +']');
  });
  return keys.join(',');
}();

FeedPoll.resolveDocumentURLs = function(document, baseURL) {
  'use strict';

  const forEach = Array.prototype.forEach;
  const baseElementList = document.querySelectorAll('base');
  const removeBaseElement = function(baseElement) {
    baseElement.remove();
  };
  forEach.call(baseElementList, removeBaseElement);

  const getNameOfAttributeWithURL = function(element) {
    return FeedPoll.ELEMENT_URL_ATTRIBUTE_MAP.get(element.localName);
  };

  const resolvables = document.querySelectorAll(FeedPoll.RESOLVE_SELECTOR);
  forEach.call(resolvables, function(element) {
    const attribute = getNameOfAttributeWithURL(element);
    const url = element.getAttribute(attribute).trim();
    const resolved = utils.resolveURL(baseURL, url);
    if(resolved && resolved !== url) {
      element.setAttribute(attribute, resolved);
    }

    if(element.localName === 'img' && element.hasAttribute('srcset')) {
      FeedPoll.resolveImageSrcSet(baseURL, element);
    }
  });
};

// Access an image element's srcset attribute, parses it into an array of
// descriptors, resolves the url for each descriptor, and then composes the
// descriptors array back into a string and modifies the element
FeedPoll.resolveImageSrcSet = function(baseURL, image) {
  'use strict';
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

  const newSource = FeedPoll.serializeSrcSet(resolvedDescriptors);
  console.debug('Changing srcset %s to %s', source, newSource);
  image.setAttribute('srcset', newSource);
};

// Returns a string representing serialized descriptors, which is a suitable
// srcset attribute value for an element
// TODO: THIS IS INCOMPLETE, because I do not yet include the other dimensions
// back into the string, and I am getting image errors in the output
// TODO: support d,w,h
// TODO: do a no-op if the urls were already absolute
FeedPoll.serializeSrcSet = function(descriptors) {
  'use strict';
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
};


// Modifies various image elements that appear as lazily-loaded in an effort
// to improve the number of images captured
FeedPoll.transformLazyImages = function(document) {
  'use strict';
  const images = document.querySelectorAll('img');
  const numImages = images.length;
  for(let i = 0; i < numImages; i++) {
    FeedPoll.transformLazyImage(images[i]);
  }
};

FeedPoll.transformLazyImage = function(image) {
  'use strict';

  // Case 1: <img lazy-state="queue" load-src="url">
  // Case 2: <img load-src="url">
  if(!image.hasAttribute('src') && image.hasAttribute('load-src')) {
    image.setAttribute('src', image.getAttribute('load-src'));
    return;
  }

  // Case 3: <img src="blankurl" class="lazy-image" data-src="url">
  if(image.hasAttribute('data-src') &&
    image.classList.contains('lazy-image')) {
    image.setAttribute('src', image.getAttribute('data-src'));
    return;
  }

  // Case 4: <img data-src="url">
  // TODO: integrate with case 3?
  if(!image.hasAttribute('src') && image.hasAttribute('data-src')) {
    image.setAttribute('src', image.getAttribute('data-src'));
    return;
  }

  // TODO: responsive design conflicts with the approach this takes,
  // this needs to be handled instead by the srcset handler
  // Case 5: <img class="lazy" data-original-desktop="url"
  // data-original-tablet="url" data-original-mobile="url">
  if(!image.hasAttribute('src') &&
    image.hasAttribute('data-original-desktop')) {
    image.setAttribute('src', image.getAttribute('data-original-desktop'));
    return;
  }

  // Case 6: <img data-baseurl="url">
  if(!image.hasAttribute('src') && image.hasAttribute('data-baseurl')) {
    image.setAttribute('src', image.getAttribute('data-baseurl'));
    return;
  }

  // Case 7: <img data-lazy="url">
  if(!image.hasAttribute('src') && image.hasAttribute('data-lazy')) {
    image.setAttribute('src', image.getAttribute('data-lazy'));
    return;
  }

  // Case 8: <img data-img-src="url">
  if(!image.hasAttribute('src') && image.hasAttribute('data-img-src')) {
    image.setAttribute('src', image.getAttribute('data-img-src'));
    return;
  }

  // Case 9: <img data-original="url">
  if(!image.hasAttribute('src') && image.hasAttribute('data-original')) {
    image.setAttribute('src', image.getAttribute('data-original'));
    return;
  }

  // Case 10: <img data-adaptive-img="">
  if(!image.hasAttribute('src') && image.hasAttribute('data-adaptive-img')) {
    image.setAttribute('src', image.getAttribute('data-adaptive-img'));
    return;
  }
};
