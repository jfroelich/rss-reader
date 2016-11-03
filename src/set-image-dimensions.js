// See license.md

'use strict';

function set_image_dimensions(doc, log) {
  return new Promise(async function impl(resolve) {
    const map = Array.prototype.map;
    const images = doc.getElementsByTagName('img');
    const promises = map.call(images, (image) =>
      get_image_dimensions(image, log));
    let results = await Promise.all(promises);
    let num_modified = 0;
    for(let dims of results) {
      if('w' in dims && !dims.known) {
        dims.image.setAttribute('width', dims.w);
        dims.image.setAttribute('height', dims.h);
        num_modified++;
      }
    }
    resolve(num_modified);
  });
}

// This always resolves so that this function can be conveniently used together
// with Promise.all, which otherwise would fail fast on the first error.
// Resolves with image because in the case of racing the link between and image
// and its fetched dimensions would be unclear, because order of resolution
// is not serial.
// TODO: Does a normal image request include cookie header?
function get_image_dimensions(image, log) {
  return new Promise(function(resolve) {
    // If the image has known dimensions then resolve immediately
    // Set known to true to enable caller to know that there is no need to
    // modify the image.
    const w_attr = image.getAttribute('width');
    const h_attr = image.getAttribute('height');
    if(w_attr && h_attr) {
      resolve({'known': true, 'image': image, 'w': w_attr, 'h': h_attr});
      return;
    }

    // Try inferring from inline style
    if(image.hasAttribute('style') && image.style.width && image.style.height) {
      resolve({'image': image, 'w': image.style.width,'h': image.style.height});
      return;
    }

    // Otherwise, plan on fetching. Cannot fetch without a src attribute
    const src = image.getAttribute('src');
    if(!src) {
      resolve({'image': image});
      return;
    }

    // If the url is invalid then cannot fetch
    let url;
    try {
      url = new URL(src);
    } catch(error) {
      resolve({'image': image});
      return;
    }

    // If the url doesn't point to a url capable of serving images then
    // cannot fetch (e.g. data:, javascript:)
    if(url.protocol !== 'http:' && url.protocol !== 'https:') {
      resolve({'image': image});
      return;
    }

    // Create in document containing this script so that it does not matter
    // if the document containing the image is inert so that setting src
    // triggers the fetch
    const proxy = new Image();
    proxy.src = url.href;

    // Resolve immediately if cached. completed is true when cached. Can only
    // check cache by using proxy.complete. image.complete is useless, I think
    // because if image comes from an inert doc such as one created by
    // DOMParser, the complete property is not set during parsing
    if(proxy.complete) {
      resolve({
        'image': image,
        'w': '' + proxy.width,
        'h': '' + proxy.height
      });
      return;
    }

    proxy.onload = function(event) {
      resolve({
        'image': image,
        'w': '' + proxy.width,
        'h': '' + proxy.height
      });
    };

    proxy.onerror = function(event) {
      resolve({'image': image});
    };
  });
}
