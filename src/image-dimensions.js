// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

// Requires: /lib/async.js
// Requires: /src/url.js

// TODO: stop using async lib
// TODO: maybe move all this stuff into image.js?
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

  // TODO: maybe I should always fetch dimensions for images with urls?
  // How much of a benefit it is to reduce the number of fetches?
  // Why do I even want to keep the original dimensions? I am using CSS to
  // restrict the widths on render. Put some more thought into this to clarify
  // the rationale.

  // Checking width is sufficient to determine whether the image has
  // dimensions. I think. I am a bit tentative about it.

  // TODO: as an aside, why am I checking for presence of URL here? Shouldn't
  // images without URLs already have been handled by this point? Or is it
  // better to be redundant and make fewer assumptions about other code and
  // the timing of when it is called.

  let url = imageElement.getAttribute('src') || '';
  url = url.trim();
  return url && !image_dimensions_is_data_url(url) && !imageElement.width;
}

function image_dimensions_is_data_url(urlString) {
  'use strict';
  return /^\s*data\s*:/i.test(urlString);
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

  function proxy_onfetch(event) {
    image_dimensions_on_fetch(imageElement, callback, event);
  }

  proxyImageElement.onload = proxy_onfetch;
  proxyImageElement.onerror = proxy_onfetch;

  // Setting the source triggers the fetch within the context of a live
  // document. We are using the document containing this script so we know
  // that proxy is located in a live context.
  proxyImageElement.src = sourceURLString;
}

// On requesting the image, if successful, update the attributes of the
// local image.
function image_dimensions_on_fetch(imageElement, callback, event) {
  'use strict';

  if(event.type === 'load') {
    const proxyImageElement = event.target;

    // Set the attributes, not the properties. The properties will be set
    // by setting the attributes. Setting properties will not set the
    // attributes. If any code does any serialization/deserialization to or
    // from innerHTML, it would not store the new values if I only set the
    // properties.

    imageElement.setAttribute('width', proxyImageElement.width);
    imageElement.setAttribute('height', proxyImageElement.height);

  } else {
    const sourceURLString = imageElement.getAttribute('src');
    console.debug('Failed to fetch image:', sourceURLString);
  }

  // Callback with no args to signal async.forEach to continue.
  callback();
}
