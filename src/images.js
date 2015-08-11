// Copyright 2014 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

var lucu = lucu || {};

// The image module for image related functions
lucu.images = {};

/**
 * Ensures that the width and height attributes of an image are set. If the
 * dimensions are set, the callback is called immediately. If not set, the
 * image is fetched and then the dimensions are set.
 *
 * Designed to work with the async lib
 */
lucu.images.fetchDimensions = function(image, callback) {
  'use strict';

  var src = (image.getAttribute('src') || '').trim();
  var width = (image.getAttribute('width') || '').trim();
  if(!src || width || image.width ||
    width === '0' || /^0\s*px/i.test(width) ||
    lucu.images.isDataURI(src)) {
    return callback();
  }

  // We load the image within a separate document context because
  // the element may currently be contained within an inert document
  // context (such as the document created by an XMLHttpRequest or when
  // using document.implementation.createDocument)
  
  // TODO: think of a better way to specify the proxy. I should not be
  // relying on window explicitly here.

  var document = window.document;
  var proxy = document.createElement('img');

  proxy.onerror = function(event) {
    console.debug('Failed to fetch %s %o', src, proxy);
    callback();
  };

  proxy.onload = function(event) {
    image.width = proxy.width;
    image.height = proxy.height;
    callback();
  };
  proxy.src = src;
};

lucu.images.isDataURI = function(imageSource) {
  return /^data\s*:/i.test(imageSource);
};
