// Transforms responsive images in document content

import assert from "/src/assert.js";
import {imageHasValidSource, imageHasSrcset} from "/src/dom.js";
import {parseSrcsetWrapper} from "/src/srcset.js";

export default function filterDocument(doc) {
  assert(doc instanceof Document);

  if(!doc.body) {
    return;
  }

  const images = doc.body.getElementsByTagName('img');
  for(const image of images) {
    if(!imageHasValidSource(image) && imageHasSrcset(image)) {
      filterImage(image);
    }
  }
}

function filterImage(image) {
  const imageSrcset = image.getAttribute('srcset');
  const descriptors = parseSrcsetWrapper(imageSrcset);

  // For the time being, the preference is whatever is first, no special handling of descriptor.d,
  // and only one dimension needed
  let preferredDescriptor;
  for(const descriptor of descriptors) {
    if(descriptor.url && (descriptor.w || descriptor.h)) {
      preferredDescriptor = descriptor;
      break;
    }
  }

  if(preferredDescriptor) {
    image.setAttribute('src', preferredDescriptor.url);
    if(preferredDescriptor.w) {
      image.setAttribute('width', '' + preferredDescriptor.w);
    }

    if(preferredDescriptor.h) {
      image.setAttribute('height', '' + preferredDescriptor.h);
    }
  }
}
