// See license.md

'use strict';

// TODO: Still see cases like this: <img data-original="url" src="url">
// Instead of checking for absence of src, maybe always overwrite
// TODO: browser may tolerate spaces in urls?

{

function transform_lazy_images(doc) {
  const images = doc.querySelectorAll('img');
  for(let img of images) {
    transform_img(img);
  }
}

const attrs = [
  'load-src',
  'data-src',
  'data-original-desktop',
  'data-baseurl',
  'data-lazy',
  'data-img-src',
  'data-original',
  'data-adaptive-img',
  'data-imgsrc',
  'data-default-src'
];

function transform_img(img) {
  if(img.hasAttribute('src') || img.hasAttribute('srcset'))
    return;
  // the space check is a minimal validation, urls may be relative
  // TODO: maybe use a regex and \s
  for(let alt_name of attrs) {
    if(img.hasAttribute(alt_name)) {
      const alt_val = img.getAttribute(alt_name);
      if(alt_val && !alt_val.trim().includes(' ')) {
        img.removeAttribute(alt_name);
        img.setAttribute('src', alt_val);
        return;
      }
    }
  }
}

this.transform_lazy_images = transform_lazy_images;

}
