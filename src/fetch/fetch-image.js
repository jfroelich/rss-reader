// Copyright 2015 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

// TODO: look into the implied timeout that is used

'use strict';

{ // BEGIN FILE SCOPE

function fetchImage(url, callback) {

  // NOTE: setting the src property of an HTMLImageElement has no
  // effect if the document containing the image is inert, such as one
  // created by createHTMLDocument or by XMLHttpRequest. So we implicitly
  // create a new image element within the host document of this source
  // file, which we assume is not inert.

  const image = document.createElement('img');
  const onFetchImageBound = onFetchImage.bind(this, callback);
  image.onload = onFetchImageBound;
  image.onerror = onFetchImageBound;
  image.src = url;
}

this.fetchImage = fetchImage;

function onFetchImage(callback, event) {
  callback(event);
}

} // END FILE SCOPE
