// See license.md
'use strict';

{ // Begin file block scope

function transform_lazy_imgs(doc) {
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
    if(is_not_lazy_img(img))
      continue;

    for(const lazy_src_attr_name of lazy_img_attrs) {
      if(img.hasAttribute(lazy_src_attr_name)) {
        const url_string = img.getAttribute(lazy_src_attr_name);
        if(is_valid_url_string(url_string)) {
          img.removeAttribute(lazy_src_attr_name);
          img.setAttribute('src', url_string);
          num_imgs_modified++;
          break;
        }
      }
    }
  }

  return num_imgs_modified;
}

function is_not_lazy_img(img) {
  return img.hasAttribute('src') || img.hasAttribute('srcset');
}

// Only minor validation for speed
function is_valid_url_string(url_string) {
  return url_string && !url_string.trim().includes(' ');
}

this.transform_lazy_imgs = transform_lazy_imgs;

} // End file block scope
