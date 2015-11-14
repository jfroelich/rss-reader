// Copyright 2015 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

// TODO: refactor to use block scope instead of class like google-feeds.js

'use strict';

// TODO: rather than pass in the host document, 
// create a method called createProxy
// remove the document parameter from detch dimensions

// Image element utilities
class ImageUtils {

  // Sets an image's dimensions and then calls the callback
  // (without arguments).
  // @param document a live document capable of loading images
  static fetchDimensions(image, callback) {
    
    let sourceURL = image.getAttribute('src') || '';
    sourceURL = sourceURL.trim();

    // Can't do anything about a sourceless image
    if(!sourceURL) {
      callback();
      return;
    }

    // Can't do anything about an embedded image aside 
    // from relying on its attributes or properties
    // TODO: or can we? Does it matter if it an inert 
    // document (e.g. created by XMLHttpRequest?)
    // TODO: isDataURI is only ever called from here, maybe 
    // the function belongs here?
    if(URLUtils.isDataURI(sourceURL)) {
      callback();
      return;
    }

    // If the image already has dimensions, do not re-fetch
    // TODO: what about height? Will Calamine's area function
    // in getImageBias fail unexpectedly?
    if(ImageUtils.hasWidth(image)) {
      callback();
      return;
    }

    // To get the image's dimensions, we recreate the image
    // locally and ask the browser to fetch it, and then 
    // transfer the retrieved properties to the image
    const proxy = ImageUtils._createProxyImage();
    proxy.onload = ImageUtils._onProxyLoad.bind(proxy, callback, image);
    proxy.onerror = ImageUtils._onProxyError.bind(proxy, callback);
    proxy.src = sourceURL;
  }

  // Returns a new image element created within the document that
  // includes image-utils.js
  static _createProxyImage() {
    // Use the implied global (e.g. instead of window.global), 
    // this way we support non-window containers
    return document.createElement('img');
  }

  // fetchDimensions helper
  static _onProxyLoad(callback, image, event) {
  	const proxy = event.target;
  	image.width = proxy.width;
  	image.height = proxy.height;
  	callback();
  }

  // fetchDimensions helper
  static _onProxyError(callback, event) {
  	callback();
  }

  // Returns truthy when the image has a non-zero width
  static hasWidth(image) {
    // TODO: there is probably some cleanup that needs to happen
    // here regarding redundancy of conditions
    const width = (image.getAttribute('width') || '').trim();
    return width && image.width && width !== '0' && 
      !/^0\s*px/i.test(width);
  }
}
