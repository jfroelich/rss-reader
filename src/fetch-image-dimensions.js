// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

(function(exports) {
'use strict';

const HOST_DOC = document;
const MIN_URL_LEN = 'http://a.gif'.length;

function fetchImageDimensions(document, callback) {
  const context = {
    'numProcessed': 0,
    'numFetched': 0,
    'numModified': 0,
    'numImages': 0,
    'callback': callback,
    'document': document
  };

  const images = document.getElementsByTagName('img');
  context.numImages = images.length;

  if(context.numImages === 0) {
    callback(0);
    return;
  }

  for(let image of images) {
    if(shouldFetchImage(image)) {
      fetchImage(context, image);
    } else {
      onImageProcessed(context);
    }
  }
}

function onImageProcessed(context) {
  context.numProcessed++;
  if(context.numProcessed === context.numImages) {
    context.callback(context.numFetched);
  }
}

function shouldFetchImage(image) {
  const src = image.getAttribute('src');
  return !image.hasAttribute('width') && !image.hasAttribute('height') &&
    src && src.length > MIN_URL_LEN && /^\s*http/i.test(src);
}

function fetchImage(context, image) {
  const proxyImage = HOST_DOC.createElement('img');
  const boundOnFetch = onFetchImage.bind(proxyImage, context, image);
  proxyImage.addEventListener('load', boundOnFetch);
  proxyImage.addEventListener('error', boundOnFetch);
  proxyImage.src = image.getAttribute('src');
}

function onFetchImage(context, image, event) {
  context.numFetched++;
  if(event.type === 'load') {
    image.setAttribute('width', event.target.width);
    image.setAttribute('height', event.target.height);
    context.numModified++;
  }
  onImageProcessed(context);
}

exports.fetchImageDimensions = fetchImageDimensions;

}(this));
