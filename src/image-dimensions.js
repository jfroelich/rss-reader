// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

// Requires: /lib/async.js
// TODO: stop using async.

// Given a document, ensure that the width and height of each image element is
// set. If not set, fetch the image, check its dimensions, and explicitly set
// the width and height attributes of the image element within the html.
function image_dimensions_set_all(document, callback) {
  'use strict';

  // TODO: restrict to document.body.

  const images = document.getElementsByTagName('img');
  const fetchables = Array.prototype.filter.call(images,
    image_dimensions_should_fetch);
  async.forEach(fetchables, image_dimensions_fetch, callback);
}

// Returns whether the image should be fetched.
// TODO: should I also check attributes?
function image_dimensions_should_fetch(image) {
  'use strict';

  let url = image.getAttribute('src') || '';
  url = url.trim();
  return url && !url_is_object(url) && !image.width;
}

// Request the image.
function image_dimensions_fetch(image, callback) {
  'use strict';

  const url = image.getAttribute('src');
  const proxy = document.createElement('img');

  proxy.onload = function proxy_onload(event) {
    image_dimensions_on_fetch(image, callback, event);
  };
  proxy.onerror = function proxy_onerror(event) {
    image_dimensions_on_fetch(image, callback, event);
  };

  // Setting the source triggers the fetch
  proxy.src = url;
}

// On requesting the image, if successful, update the attributes of the
// local image.
// TODO: shouldn't I actually be setting the attributes and not just the
// properties? What if the properties are not serialized as attributes when
// converting back to a string?
function image_dimensions_on_fetch(image, callback, event) {
  'use strict';

  if(event.type === 'load') {
    const proxy = event.target;
    image.width = proxy.width;
    image.height = proxy.height;
  } else {
    console.debug('Failed to fetch image:', image.getAttribute('src'));
  }

  callback();
}
