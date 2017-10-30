'use strict';

// import net/url.js
// import dom.js

function lazy_image_filter(doc) {
  console.assert(doc instanceof Document);

  if(!doc.body) {
    return STATUS_OK;
  }

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

  const images = doc.body.getElementsByTagName('img');
  for(const img of images) {
    if(dom_image_has_source(img)) {
      continue;
    }

    for(const lazy_src_attr_name of lazy_img_attrs) {
      if(img.hasAttribute(lazy_src_attr_name)) {
        const url_string = img.getAttribute(lazy_src_attr_name);
        if(url_is_valid(url_string)) {
          const pre_html = img.outerHTML;
          img.removeAttribute(lazy_src_attr_name);
          img.setAttribute('src', url_string);
          const post_html = img.outerHTML;
          console.log('lazy:', pre_html, post_html);
          break;
        }
      }
    }
  }

  return STATUS_OK;
}
