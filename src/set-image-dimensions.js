// See license.md

'use strict';

function set_image_dimensions(doc, log) {
  return new Promise(set_image_dimensions_impl.bind(undefined, doc, log));
}

async function set_image_dimensions_impl(doc, log, resolve, reject) {
  let num_modified = 0;
  const images = doc.getElementsByTagName('img');
  for(let image of images) {
    if(image.getAttribute('width') || image.getAttribute('height'))
      continue;
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
      num_modified++;
      continue;
    }

    const src = image.getAttribute('src');
    if(!src)
      continue;

    try {
      const url = new URL(src);
      if(url.protocol !== 'http:' && url.protocol !== 'https:')
        continue;
      let dims = await fetch_image_dimensions(url.href);
      // log.debug('Fetched img dims', url.href, dims.w, dims.h);
      image.setAttribute('width', dims.w);
      image.setAttribute('height', dims.h);
      num_modified++;
    } catch(error) {
      log.debug(error);
    }
  }

  resolve(num_modified);
}

function fetch_image_dimensions(url) {
  return new Promise(fetch_image_dimensions_impl.bind(undefined, url));
}

function fetch_image_dimensions_impl(url, resolve, reject) {
  // Create in document containing this script
  const proxy = new Image();
  proxy.src = url;
  // Resolve immediately if cached
  if(proxy.complete) {
    resolve({'w': proxy.width, 'h': proxy.height});
    return;
  }
  proxy.onload = function(event) {
    resolve({'w': event.target.width, 'h': event.target.height});
  };
  proxy.onerror = function(event) {
    console.dir(event);
    // todo: test how to get the error message
    reject(event);
  };
}
