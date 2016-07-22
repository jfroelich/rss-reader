// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

class ImageDimensionsService {
  constructor() {
    this.log = new LoggingService();
    this.hostDocument = document;
  }

  modifyDocument(document, callback) {
    const context = {
      'numProcessed': 0,
      'numFetched': 0,
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
      if(image.width && !image.hasAttribute('width')) {
        image.setAttribute('width', image.width);
      }

      if(image.height && !image.hasAttribute('height')) {
        image.setAttribute('height', image.height);
      }

      if(image.hasAttribute('width') && image.hasAttribute('height')) {
        this.onImageProcessed(context);
        continue;
      }

      let urlString = image.getAttribute('src') || '';

      if(!this.isHTTPUrl(urlString)) {
        this.onImageProcessed(context);
        continue;
      }

      this.fetchImage(context, image);
    }
  }

  isHTTPUrl(urlString) {
    return urlString.length > 8 && /^\s*http/i.test(urlString);
  }

  onImageProcessed(context) {
    context.numProcessed++;
    if(context.numProcessed === context.numImages) {
      context.callback(context.document);
    }
  }

  fetchImage(context, image) {
    const sourceURLString = image.getAttribute('src');
    this.log.debug('ImageDimensionService: fetching', sourceURLString);
    const proxyImage = this.hostDocument.createElement('img');
    const boundOnFetch = this.onFetchImage.bind(this, context, image);
    proxyImage.onload = boundOnFetch;
    proxyImage.onerror = boundOnFetch;
    proxyImage.src = sourceURLString;
  }

  onFetchImage(context, image, event) {
    context.numFetched++;
    const proxyImage = event.target;
    if(event.type === 'load') {
      if(!image.hasAttribute('width')) {
        this.log.debug('ImageDimensionService: setting width',
          image.getAttribute('src'), proxyImage.width);
        image.setAttribute('width', proxyImage.width);
      }

      if(!image.hasAttribute('height')) {
        this.log.debug('ImageDimensionService: setting height',
          image.getAttribute('src'), proxyImage.height);
        image.setAttribute('height', proxyImage.height);
      }
    } else {
      this.log.debug('ImageDimensionService: error fetching',
        image.getAttribute('src'));
      // TODO: if I got an error, consider removing the image element
      // from the document. Also, don't forget that if I do this I need
      // to be using a static node list, as in, I need to be using
      // querySelectorAll and not getElementsByTagName
    }

    this.onImageProcessed(context);
  }
}
