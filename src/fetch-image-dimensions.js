// Copyright 2014 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

var lucu = lucu || {};

/**
 * Inspects the dimensions of an image, and if not set, fetches
 * them and sets the dimensions, and then calls the callback.
 *
 * @param document - a document used as a proxy to fetch the image, which
 * is helpful when the image is contained within an inert document because you
 * can use a different document context that is live. To use the document that
 * contains the image, use image.ownerDocument as the first argument. If
 * document is undefined, then image.ownerDocument is substituted.
 * @param image - an image HTMLElement
 * @param callback a function to call when finished, no args
 */
lucu.fetchImageDimensions = function(document, image, callback) {
  'use strict';
  var src = (image.getAttribute('src') || '').trim();
  var width = (image.getAttribute('width') || '').trim();
  if(!src || width || image.width ||
    width === '0' || /^0\s*px/i.test(width) ||
    /^data\s*:/i.test(src)) {
    return callback();
  }

  document = document || image.ownerDocument;

  var proxy = document.createElement('img');
  proxy.onerror = callback;
  proxy.onload = function(event) {
    image.width = proxy.width;
    image.height = proxy.height;
    callback();
  };
  proxy.src = src;
};
