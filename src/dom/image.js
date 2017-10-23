'use strict';

// import http/url.js

// Return true if the first parameter is an image element
function image_is_image(image) {
  // TODO: be more precise, use HTMLImageElement or whatever it is
  return image instanceof Element;
}

// TODO: also has source if within picture and picture has <source>, or
// alternatively rename to image_has_source_attribute
function image_has_source(image) {
  console.assert(image_is_image(image));
  return image.hasAttribute('src') || image_has_srcset(image);
}

// Return true if image has a valid src attribute value
function image_has_valid_source(image) {
  console.assert(image_is_image(image));
  return url_is_valid(image.getAttribute('src'));
}

// Return true if image has a non-empty srcset attribute value
function image_has_srcset(image) {
  console.assert(image_is_image(image));
  const srcset_value = image.getAttribute('srcset');
  return srcset_value && srcset_value.trim();
}

// Searches for and returns the corresponding figcaption element
function image_find_caption(image) {
  console.assert(image_is_image(image));
  let figcaption;
  const figure = image.closest('figure');
  if(figure) {
    figcaption = figure.querySelector('figcaption');
  }
  return figcaption;
}
