// Copyright 2015 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

// TODO: move this and all other transforms into parent src folder, i don't
// think the extra nesting is needed, these are general and independent
// functions

'use strict';

{ // BEGIN ANONYMOUS NAMESPACE


// TODO: this also serves to check if an image's src is correct. consider
// removing 404 images or replacing them with an error message.

const filter = Array.prototype.filter;

// Asynchronously attempts to set the width and height for
// all image elements. Calls callback when complete
function fetchImages(document, callback) {
  const images = document.getElementsByTagName('img');
  const fetchables = filter.call(images, _shouldFetch);
  async.forEach(fetchables, _fetch, callback);
}

this.fetchImageDimensions = fetchImages;

// Returns true if the image should be fetched
function _shouldFetch(image) {

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
  // TODO: isDataURI is only ever called from here, maybe
  // the function belongs here?
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

// Sets an image's dimensions and then calls the callback
// (without arguments).
function _fetch(image, callback) {

  // To get the image's dimensions, we recreate the image
  // locally and ask the browser to fetch it, and then
  // transfer the retrieved properties to the image. This
  // avoids the issue that setting the src property on the
  // image has no effect if the image comes from an
  // inert document
  const url = image.getAttribute('src');
  const proxy = document.createElement('img');
  proxy.onload = onProxyLoad.bind(proxy, callback, image);
  proxy.onerror = onProxyError.bind(proxy, callback);
  proxy.src = url;
};

function onProxyLoad(callback, image, event) {
  const proxy = event.target;
  image.width = proxy.width;
  image.height = proxy.height;
  // Call with no args to indicate async.forEach should continue
  callback();
}

// We wrap the callback so that we can pass it no args in order to prevent
// async.forEach from stopping prematurely when a load error occurs
function onProxyError(callback, event) {
  callback();
}

} // END ANONYMOUS NAMESPACE
