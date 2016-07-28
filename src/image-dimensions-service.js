// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

class ImageDimensionsService {

  modifyDocument(document, callback) {
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

    if(!context.numImages) {
      callback(document);
      return;
    }

    for(let image of images) {
      if(this.shouldFetchImage(image)) {
        this.fetchImage(context, image);
      } else {
        this.onImageProcessed(context);
      }
    }
  }

  shouldFetchImage(image) {
    const src = image.getAttribute('src');
    const minSrcLength = 'http://a.gif'.length;
    return !image.hasAttribute('width') && !image.hasAttribute('height') &&
      src && src.length > minSrcLength && /^\s*http/i.test(src);
  }

  onImageProcessed(context) {
    context.numProcessed++;
    if(context.numProcessed === context.numImages) {
      context.callback(context.document);
    }
  }

  fetchImage(context, image) {
    const proxyImage = document.createElement('img');
    const boundOnFetch = this.onFetchImage.bind(this, context, image);
    proxyImage.addEventListener('load', boundOnFetch);
    proxyImage.addEventListener('error', boundOnFetch);
    proxyImage.src = image.getAttribute('src');
  }

  onFetchImage(context, image, event) {
    context.numFetched++;
    if(event.type === 'load') {
      image.setAttribute('width', event.target.width);
      image.setAttribute('height', event.target.height);
      context.numModified++;
    }
    this.onImageProcessed(context);
  }
}
