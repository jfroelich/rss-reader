import * as srcsetUtils from '/lib/srcset-utils.js';

// Set the src/width/height attributes for images that only provide srcset
export default function transform(document) {
  const images = document.querySelectorAll('img[srcset]:not([src])');
  for (const image of images) {
    transformImage(image);
  }
}

function transformImage(image) {
  const descriptors = srcsetUtils.parse(image.getAttribute('srcset'));
  const chosenDescriptor = chooseDescriptor(descriptors);

  if (!chosenDescriptor) {
    return;
  }

  // To prevent skew we have to remove the original dimensions
  image.removeAttribute('width');
  image.removeAttribute('height');

  image.removeAttribute('srcset');

  image.setAttribute('src', chosenDescriptor.url);
  if (chosenDescriptor.w) {
    image.setAttribute('width', `${chosenDescriptor.w}`);
  }
  if (chosenDescriptor.h) {
    image.setAttribute('height', `${chosenDescriptor.h}`);
  }
}

// Select the most appropriate descriptor from the set of descriptors. This is not a spec compliant
// implementation. This is just a simple implementation that works quickly. Is not guaranteed to
// return a descriptor.
function chooseDescriptor(descriptors) {
  let chosenDescriptor = null;
  for (const desc of descriptors) {
    if (desc.url) {
      if (desc.w || desc.h) {
        chosenDescriptor = desc;
        break;
      } else if (!chosenDescriptor) {
        chosenDescriptor = desc; // continue searching
      }
    }
  }
  return chosenDescriptor;
}
