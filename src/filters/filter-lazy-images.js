import {image_has_source} from '/src/dom/image-has-source.js';

const lazy_image_attribute_names = [
  'load-src', 'data-src', 'data-src-full16x9', 'data-src-large',
  'data-original-desktop', 'data-baseurl', 'data-flickity-lazyload',
  'data-lazy', 'data-path', 'data-image-src', 'data-original',
  'data-adaptive-image', 'data-imgsrc', 'data-default-src', 'data-hi-res-src'
];

export function filter_lazy_images(document) {
  if (document.body) {
    const images = document.body.getElementsByTagName('img');
    for (const image of images) {
      if (!image_has_source(image)) {
        const attr_names = image.getAttributeNames();
        for (const attr_name of lazy_image_attribute_names) {
          if (attr_names.includes(attr_name)) {
            const lazy_attr_value = image.getAttribute(attr_name);
            if (is_valid_url_string(lazy_attr_value)) {
              image.removeAttribute(attr_name);
              image.setAttribute('src', lazy_attr_value);
              break;
            }
          }
        }
      }
    }
  }
}

// Only minor validation for speed. Tolerates bad input. This isn't intended to
// be the most accurate classification. Instead, it is intended to easily find
// bad urls and rule them out as invalid, even though some slip through, and not
// unintentionally rule out good urls.
// @param value {Any} should be a string but this tolerates bad input
// @returns {Boolean}
function is_valid_url_string(value) {
  // The upper bound on len is an estimate, kind of a safeguard, hopefully never
  // causes a problem
  return typeof value === 'string' && value.length > 1 &&
      value.length <= 3000 && !value.trim().includes(' ');
}
