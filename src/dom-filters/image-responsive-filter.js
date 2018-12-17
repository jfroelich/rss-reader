import * as srcset from '/src/dom-utils/srcset-utils.js';

// Transforms responsive images in document content. An image is 'responsive' if
// it uses a srcset instead of a src, such that the actual image used is derived
// dynamically after the document has been loaded. This filter looks for such
// images and changes them to use one of the descriptors from the srcset as the
// src.
export function image_responsive_filter(document) {
  if (document.body) {
    const images = document.body.getElementsByTagName('img');
    for (const image of images) {
      if (!image.hasAttribute('src') && image.hasAttribute('srcset')) {
        const descriptor = image_find_best_srcset_descriptor(image);
        if (descriptor) {
          image_transform_to_descriptor(image, descriptor);
        }
      }
    }
  }
}

// Selects the best srcset to use from an image's srcset attribute value.
// Returns the parsed descriptor object. Returns undefined if no descriptor
// found
function image_find_best_srcset_descriptor(image) {
  const srcset_attr_value = image.getAttribute('srcset');
  if (!srcset_attr_value) {
    return;
  }

  const descriptors = srcset.parse(srcset_attr_value);

  // For the time being, the preference is whatever is first, no special
  // handling of descriptor.d, and only one dimension needed
  for (const desc of descriptors) {
    if (desc.url && (desc.w || desc.h)) {
      return desc;
    }
  }

  // If we did not find a descriptor above, search again but relax the
  // dimensions requirement
  for (const desc of descriptors) {
    if (desc.url) {
      return desc;
    }
  }
}

// Changes the src, width, and height of an image to the properties of the
// given descriptor, and removes the srcset attribute.
function image_transform_to_descriptor(image, descriptor) {
  image.setAttribute('src', descriptor.url);

  // The srcset is no longer in use
  image.removeAttribute('srcset');

  // Also change the width and height attributes. This avoids scaling issues

  if (descriptor.w) {
    image.setAttribute('width', '' + descriptor.w);
  } else {
    image.removeAttribute('width');
  }

  if (descriptor.h) {
    image.setAttribute('height', '' + descriptor.h);
  } else {
    image.removeAttribute('height');
  }
}
