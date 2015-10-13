// Copyright 2014 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

var lucu = lucu || {};

// Feed augmentation lib
lucu.augment = {};

// TODO: each entry should be processed simultaneously. This should not 
// be responsible for iterating over the entries

// TODO: this should probably be renamed if it isn't doing any 
// iteration. In fact the start function should probably just 
// be deleted and should make direct calls to updateEntryContent
// (which should also be renamed)

/**
 * Iterates over a feed's entries and replaces the html content property
 * of each entry with its full html according to its link. Forwards the
 * input feed to the callback.
 */
lucu.augment.start = function(feed, callback) {
  'use strict';

  async.forEach(feed.entries, lucu.augment.updateEntryContent, function() {
    callback();
  });
};

lucu.augment.FETCH_TIMEOUT = 20 * 1000;

/**
 * Fetch the html at entry.link and use it to replace entry.content
 *
 * TODO: I'd prefer this function pass back any errors to the callback. This
 * would require the caller that wants to not break from async.forEach early
 * wrap the call.
 * TODO: I'd prefer this properly pass back errors to the callback and instead
 * require the caller to wrap this call in order to ignore such errors and
 * continue iteration if they want to use this function within the context of
 * async.forEach
 * TODO: consider embedding iframe content?
 * TODO: consider sandboxing iframes?
 * TODO: should entry timeout be a parameter? I want it somehow to be
 * declared external to this function
 * TODO: html compression? like enforce boolean attributes? see kangax lib
 * TODO: scrubbing/html-tidy (e.g. remove images without src attribute?)
 * TODO: if pdf content type then maybe we embed iframe with src
 * to PDF? also, we should not even be trying to fetch pdfs? is this
 * just a feature of fetchHTML or does it belong here?
 * TODO: do something with responseURL?
 */
lucu.augment.updateEntryContent = function(entry, callback) {
  'use strict';
  
  const request = new XMLHttpRequest();
  request.timeout = lucu.augment.FETCH_TIMEOUT;
  const onError = lucu.augment.onFetchDocumentError.bind(request, callback);
  request.ontimeout = onError;
  request.onerror = onError;
  request.onabort = onError;
  request.onload = lucu.augment.onFetchDocument.bind(request, entry, callback);
  request.open('GET', entry.link, true);
  request.responseType = 'document';
  request.send();  
};

lucu.augment.onFetchDocumentError = function(callback, errorEvent) {
  'use strict';
  console.warn(errorEvent);
  callback();
};

lucu.augment.onFetchDocument = function(entry, callback, event) {
  'use strict';
  
  const request = event.target;
  const document = request.responseXML;
  
  if(!document || !document.body) {

    callback();
    return;
  }

  // Resolve all the links in the document
  lucu.resolver.resolveDocument(document, request.responseURL);

  // Try and set the dimensions for all the images in the document
  const images = document.body.getElementsByTagName('img');
  const onImagesUpdated = lucu.augment.onImagesUpdated.bind(null, entry, 
    document, callback);
  async.forEach(images, lucu.images.fetchDimensions, onImagesUpdated);  
};

lucu.augment.onImagesUpdated = function(entry, document, callback) {
  // We know document and document.body are defined, we checked before

  // console.debug('lucu.augment.onImagesUpdated %s', entry.link);

  const content = document.body.innerHTML;
  
  if(content) {
    // Replace the original content with the full content
    entry.content = content;
  } else {
    entry.content = 'Unable to download content for this article';
  }

  callback();
};

lucu.augment.onComplete = function(feed, callback) {

  // TODO: why am I passing feed here? I don't think this is consistent and 
  // cannot remember if the caller expects it.
  callback(feed);
};
