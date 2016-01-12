// Copyright 2015 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

// TODO: this also serves to check if an image's src is correct. consider
// removing 404 images or replacing them with an error message.
// so maybe this has to be a more general process-images document-transform?
// The idea is that we only want to touch images once.
// TODO: this needs to consider srcset, which makes it much more tricky,
// because there could be multiple dimensions to consider, and also, because
// filterSourcelessImages delegates responsive design loading mechanics to
// the browser. The current design makes this nearly impossible, e.g.
// shouldFetch doesn't even make sense
// TODO: decouple async to allow for passing parameters to callback

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
    // There was an error fetching the image
    console.debug('fetchImage error %o', event);
  }

  // Use no args so as to work with async.forEach
  callback();
}

} // END ANONYMOUS NAMESPACE
