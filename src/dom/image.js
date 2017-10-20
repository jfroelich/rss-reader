'use strict';

// TODO: also has source if within picture and picture has <source>, or
// alternatively rename to image_has_source_attribute
function image_has_source(image) {
  return image.hasAttribute('src') || image.hasAttribute('srcset');
}

// Return true if image has a valid src attribute value
function image_has_valid_source(image) {
  const min_url_length = 2;
  let src_value = image.getAttribute('src');
  if(src_value) {
    src_value = src_value.trim();
    return (src_value.length > min_url_length) && !src_value.includes(' ');
  }
}

// Return true if image has a non-empty srcset attribute value
function image_has_srcset(image) {
  const srcset_value = image.getAttribute('srcset');
  return srcset_value && srcset_value.trim();
}

// Searches for and returns the corresponding figcaption element
function image_find_caption(image) {
  let figcaption;
  const figure = image.closest('figure');
  if(figure) {
    figcaption = figure.querySelector('figcaption');
  }
  return figcaption;
}
