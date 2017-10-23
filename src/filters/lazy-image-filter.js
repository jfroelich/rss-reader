'use strict';

// import dom/image.js
// import url.js

function lazy_image_filter(doc) {
  console.assert(doc instanceof Document);

  const lazy_img_attrs = [
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

  let num_imgs_modified = 0;
  const images = doc.getElementsByTagName('img');
  for(const img of images) {
    if(image_has_source(img))
      continue;

    for(const lazy_src_attr_name of lazy_img_attrs) {
      if(img.hasAttribute(lazy_src_attr_name)) {
        const url_string = img.getAttribute(lazy_src_attr_name);
        if(url_is_valid(url_string)) {
          img.removeAttribute(lazy_src_attr_name);
          img.setAttribute('src', url_string);
          console.log('lazy_image_filter', img.outerHTML);
          num_imgs_modified++;
          break;
        }
      }
    }
  }

  return num_imgs_modified;
}
