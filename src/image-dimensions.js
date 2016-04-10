// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file


// Requires: /lib/async.js
// Requires: /src/url.js

// TODO: stop using async lib
// TODO: maybe move all this stuff into image.js
// TODO: track num fetched, errors

// Given a document, ensure that the width and height of each image element is
// set. If not set, fetch the image, check its dimensions, and explicitly set
// the width and height attributes of the image element within the html.
function image_dimensions_set_all(document, callback) {
  'use strict';

  const bodyElement = document.body;
  if(!bodyElement) {
    // The callback expects no args
    callback();
    return;
  }

  const imageNodeList = bodyElement.getElementsByTagName('img');
  const fetchables = Array.prototype.filter.call(imageNodeList,
    image_dimensions_should_fetch);
  async.forEach(fetchables, image_dimensions_fetch, callback);
}

// Returns whether the image should be fetched.
// TODO: should I also check attributes?
function image_dimensions_should_fetch(imageElement) {
  'use strict';

  // Checking width is sufficient to determine whether the image has
  // dimensions. I think. I am a bit tentative about it.

  let url = imageElement.getAttribute('src') || '';
  url = url.trim();
  return url && !url_is_object(url) && !imageElement.width;
}

// Request the image.
function image_dimensions_fetch(imageElement, callback) {
  'use strict';

  // Proxy is intentionally created within the local document
  // context. We know it is live, so Chrome will eagerly fetch upon
  // changing the image element's src property. We do not know if the
  // input image resides in an live or inert document, so we cannot
  // safely expect that creating the proxy within its document, accessed
  // via imageElement.ownerDocument, would even do anything.

  // We know urlString is defined because it was checked before calling.

  const sourceURLString = imageElement.getAttribute('src');
  const proxyImageElement = document.createElement('img');

  proxyImageElement.onload = function proxy_onload(event) {
    image_dimensions_on_fetch(imageElement, callback, event);
  };

  proxyImageElement.onerror = function proxy_onerror(event) {
    image_dimensions_on_fetch(imageElement, callback, event);
  };

  // Setting the source triggers the fetch
  proxyImageElement.src = sourceURLString;
}

// On requesting the image, if successful, update the attributes of the
// local image.
// TODO: shouldn't I actually be setting the attributes and not just the
// properties? What if the properties are not serialized as attributes when
// converting back to a string?
function image_dimensions_on_fetch(imageElement, callback, event) {
  'use strict';

  if(event.type === 'load') {
    const proxyImageElement = event.target;
    imageElement.width = proxyImageElement.width;
    imageElement.height = proxyImageElement.height;
  } else {
    const sourceURLString = imageElement.getAttribute('src');
    console.debug('Failed to fetch image:', sourceURLString);
  }

  // Callback with no args to signal async.forEach to continue.
  callback();
}
