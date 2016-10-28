// See license.md

'use strict';

function set_image_dimensions(doc, log) {
  return new Promise(set_image_dimensions_impl.bind(undefined, doc, log));
}

async function set_image_dimensions_impl(doc, log, resolve, reject) {
  let num_modified = 0;
  const images = doc.getElementsByTagName('img');
  const promises = Array.prototype.map.call(images, (image) =>
    new Promise(fetch_image_dimensions.bind(undefined, image, log)));
  await Promise.all(promises);
  resolve();
}

function fetch_image_dimensions(image, log, callback) {

  if(image.getAttribute('width') || image.getAttribute('height')) {
    callback();
    return;
  }

  let inferred_from_style = false;
  if(image.hasAttribute('style')) {
    if(image.style.width) {
      image.setAttribute('width', image.style.width);
      inferred_from_style = true;
    }
    if(image.style.height) {
      image.setAttribute('height', image.style.height);
      inferred_from_style = true;
    }
  }

  if(inferred_from_style) {
    callback();
    return;
  }

  const src = image.getAttribute('src');
  if(!src) {
    callback(); // always callback because of Promise.all
    return;
  }

  let url;
  try {
    url = new URL(src);
  } catch(error) {
    callback(); // aways callback because of Promise.all
    return;
  }

  if(url.protocol !== 'http:' && url.protocol !== 'https:') {
    callback(); // aways callback because of Promise.all
    return;
  }

  // Create in document containing this script
  const proxy = new Image();
  proxy.src = url.href;
  // Resolve immediately if cached
  if(proxy.complete) {
    image.setAttribute('width', proxy.width);
    image.setAttribute('height', proxy.height);
    callback();
    return;
  }

  proxy.onload = function(event) {
    image.setAttribute('width', proxy.width);
    image.setAttribute('height', proxy.height);
    callback();
  };
  proxy.onerror = function(event) {
    callback(); // always callback because of Promise.all
  };
}
