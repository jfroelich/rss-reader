// See license.md

'use strict';

async function set_image_dimensions(doc, log) {
  const map = Array.prototype.map;
  const filter = Array.prototype.filter;
  let images = doc.getElementsByTagName('img');
  images = filter.call(images,
    (img) => !img.hasAttribute('width') && !img.hasAttribute('height'));
  const proms = map.call(images, (img) => get_image_dimensions(img, log));
  let results = await Promise.all(proms);
  results = results.filter((r) => 'w' in r);
  for(let r of results) {
    r.image.setAttribute('width', r.w);
    r.image.setAttribute('height', r.h);
  }
  return results.length;
}

async function get_image_dimensions(image, log) {
  if(image.hasAttribute('style') && image.style.width && image.style.height)
    return {'image': image, 'w': image.style.width,'h': image.style.height};
  const src = image.getAttribute('src');
  if(!src)
    return {'image': image};

  let url;
  try {
    url = new URL(src);
  } catch(error) {
    return {'image': image};
  }

  if(url.protocol !== 'http:' && url.protocol !== 'https:')
    return {'image': image};

  try {
    const proxy = await fetch_image_element(url.href);
    return {'image': image, 'w': proxy.width,'h': proxy.height};
  } catch(error) {
    console.debug(url.href, error);
  }

  return {'image': image};
}

// Fetch an image element.
// TODO: Does a normal image request include cookie header?
// TODO: test if error property exists
// @param url {String} an image url
function fetch_image_element(url) {
  return new Promise(function(resolve, reject) {
    if(typeof url !== 'string')
      return reject(new TypeError('url is not a string'));
    const image = new Image();
    image.src = url;
    if(image.complete)
      return resolve(image);
    image.onload = (event) => resolve(image);
    image.onerror = (event) => reject(image.error);
  });
}
