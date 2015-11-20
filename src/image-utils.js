// Copyright 2015 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

// Image element utilities
const ImageUtils = {};

{ // BEGIN ANONYMOUS NAMESPACE

// Sets an image's dimensions and then calls the callback
// (without arguments).
ImageUtils.fetchDimensions = function(image, callback) {
  
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
  // Are the width and height properties automatically set
  // for a data URI within an inert document context? If so,
  // then we do not need to fetch.
  if(URLUtils.isDataURI(sourceURL)) {
    callback();
    return;
  }

  // If the image already has dimensions, do not re-fetch
  // TODO: what about height? Will Calamine's area function
  // in getImageBias fail unexpectedly?
  if(image.width > 0) {
    callback();
    return;
  }

  // To get the image's dimensions, we recreate the image
  // locally and ask the browser to fetch it, and then 
  // transfer the retrieved properties to the image. This 
  // avoids the issue that setting the src property on the 
  // image has no effect if the image comes from an 
  // inert document (e.g. one fetched by XMLHttpRequest 
  // or created by document.implementation)
  const proxy = document.createElement('img');
  proxy.onload = onProxyLoad.bind(proxy, callback, image);
  proxy.onerror = onProxyError.bind(proxy, callback);
  proxy.src = sourceURL;
};

function onProxyLoad(callback, image, event) {
	const proxy = event.target;
	image.width = proxy.width;
	image.height = proxy.height;
	callback();
}

function onProxyError(callback, event) {
	callback();
}

} // END ANONYMOUS NAMESPACE
