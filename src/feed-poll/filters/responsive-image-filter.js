import assert from '/src/common/assert.js';
import {parseSrcsetWrapper} from '/src/feed-poll/filters/content-filter-utils.js';

// Transforms responsive images in document content

// An image is 'responsive' if it uses a srcset instead of a src, such that the
// actual image used is derived dynamically after the document has been loaded.
// This filter looks for such images and changes them to use one of the
// descriptors from the srcset as the src.

export default function main(doc) {
  assert(doc instanceof Document);
  if (!doc.body) {
    return;
  }

  const images = doc.body.getElementsByTagName('img');
  for (const image of images) {
    if (!image.hasAttribute('src') && image.hasAttribute('srcset')) {
      const descriptor = findBestSrcsetDescriptorForImage(image);
      if (descriptor) {
        transformImageToDescriptor(image, descriptor);
      } else {
        console.debug('Could not find descriptor for image', image.outerHTML);
      }
    }
  }
}

// Selects the best srcset to use from an image's srcset attribute value.
// Returns the parsed descriptor object. Returns undefined if no descriptor
// found
function findBestSrcsetDescriptorForImage(image) {
  const srcsetValue = image.getAttribute('srcset');
  if (!srcsetValue) {
    return;
  }

  const descriptors = parseSrcsetWrapper(srcsetValue);

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
function transformImageToDescriptor(image, descriptor) {
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
