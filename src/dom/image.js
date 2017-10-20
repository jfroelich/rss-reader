'use strict';

// import base/assert.js

// Return true if the first parameter is an image element
function image_is_image(image) {
  // TODO: implement, maybe use a simple duck type test
  return true;
}


// TODO: also has source if within picture and picture has <source>, or
// alternatively rename to image_has_source_attribute
function image_has_source(image) {
  ASSERT(image_is_image(image));
  return image.hasAttribute('src') || image.hasAttribute('srcset');
}

// Return true if image has a valid src attribute value
function image_has_valid_source(image) {
  ASSERT(image_is_image(image));
  const min_url_length = 2;
  let src_value = image.getAttribute('src');
  if(src_value) {
    src_value = src_value.trim();
    return (src_value.length > min_url_length) && !src_value.includes(' ');
  }
}

// Return true if image has a non-empty srcset attribute value
function image_has_srcset(image) {
  ASSERT(image_is_image(image));
  const srcset_value = image.getAttribute('srcset');
  return srcset_value && srcset_value.trim();
}

// Searches for and returns the corresponding figcaption element
function image_find_caption(image) {
  ASSERT(image_is_image(image));
  let figcaption;
  const figure = image.closest('figure');
  if(figure) {
    figcaption = figure.querySelector('figcaption');
  }
  return figcaption;
}
