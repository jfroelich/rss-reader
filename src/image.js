// Image utilities

'use strict';

// TODO: also has source if within picture and picture has <source>, or
// alternatively rename to image_has_src_attribute
function image_has_source(img) {
  return img.hasAttribute('src') || img.hasAttribute('srcset');
}

// Return true if image has a valid src attribute value
// TODO: use fn and param names consistent with image_has_source
function image_has_valid_src(image_element) {
  const min_url_length = 2;
  let src_value = image_element.getAttribute('src');
  if(src_value) {
    src_value = src_value.trim();
    return (src_value.length > min_url_length) && !src_value.includes(' ');
  }
}

// Return true if image has a srcset attribute value
function image_has_srcset(image_element) {
  const srcset_value = image_element.getAttribute('srcset');
  return srcset_value && srcset_value.trim();
}
