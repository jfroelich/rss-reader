'use strict';

// import base/errors.js
// import dom.js

function responsiveImageFilter(doc) {
  console.assert(doc instanceof Document);

  if(!doc.body) {
    return RDR_OK;
  }

  const images = doc.body.getElementsByTagName('img');
  for(const image of images) {
    if(!domImageHasValidSource(image) && domImageHasSrcset(image)) {
      responsiveImageFilterImage(image);
    }
  }

  return RDR_OK;
}

function responsiveImageFilterImage(image) {
  const imageSrcset = image.getAttribute('srcset');
  const descriptors = domSrcsetParseFromString(imageSrcset);

  // For the time being, the preference is whatever is first, no special
  // handling of descriptor.d, and only one dimension needed
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
