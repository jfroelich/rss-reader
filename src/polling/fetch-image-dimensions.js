// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

// Requires: /fetch/fetch-image.js

'use strict';

{ // BEGIN ANONYMOUS NAMESPACE

// Asynchronously attempts to set the width and height for
// all image elements. Calls callback when complete
function fetchImageDimensions(document, callback) {
  const images = document.getElementsByTagName('img');

  const filter = Array.prototype.filter;
  const fetchables = filter.call(images, shouldFetchImage);
  async.forEach(fetchables, fetch, callback);
}

this.fetchImageDimensions = fetchImageDimensions;

// Returns true if the image should be fetched
function shouldFetchImage(image) {

  // We use the attribute, not the property, to avoid any
  // changes by the user agent to the value
  let sourceURL = image.getAttribute('src') || '';
  sourceURL = sourceURL.trim();

  // Can't do anything about a sourceless image
  if(!sourceURL) {
    return false;
  }

  // Can't do anything about an embedded image aside
  // from relying on its attributes or properties
  // TODO: or can we? Does it matter if it an inert
  // document (e.g. created by XMLHttpRequest?)
  // Are the width and height properties automatically set
  // for a data URI within an inert document context? If so,
  // then we do not need to fetch.
  // TODO: can we test against url.protocol instead of using
  // a regex? or is there something like isObjectURL?
  if(/^\s*data\s*:/i.test(sourceURL)) {
    return false;
  }

  // If the image already has dimensions, do not re-fetch
  if(image.width > 0) {
    return false;
  }

  return true;
}

function fetch(image, callback) {
  const url = image.getAttribute('src');
  const boundOnFetchImage = onFetchImage.bind(null, image, callback);
  fetchImage(url, boundOnFetchImage);
}

function onFetchImage(image, callback, event) {
  if(event.type === 'load') {
    const fetchedImage = event.target;
    image.width = fetchedImage.width;
    image.height = fetchedImage.height;
  } else {
    // Here, event.type === 'error' usually, but there is not
    // much else in terms of useful information
    // It does serve as a hint that the url is invalid however
    // (even though it could be valid but temporarily unreachable)
  }

  // Use no args to indicate to async.forEach that it should continue
  callback();
}

} // END ANONYMOUS NAMESPACE
