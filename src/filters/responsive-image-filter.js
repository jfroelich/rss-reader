'use strict';

// import base/errors.js
// import dom.js

function response_image_filter(doc) {
  console.assert(doc instanceof Document);

  if(!doc.body) {
    return RDR_OK;
  }

  const images = doc.body.getElementsByTagName('img');
  for(const image of images) {
    if(!dom_image_has_valid_source(image) && dom_image_has_srcset(image)) {
      responsive_image_filter_image(image);
    }
  }

  return RDR_OK;
}

function responsive_image_filter_image(image) {
  const srcset_value = image.getAttribute('srcset');
  const descriptors = dom_srcset_parse_from_string(srcset_value);

  // For the time being, the preference is whatever is first, no special
  // handling of descriptor.d, and only one dimension needed
  let preferred_descriptor;
  for(const descriptor of descriptors) {
    if(descriptor.url && (descriptor.w || descriptor.h)) {
      preferred_descriptor = descriptor;
      break;
    }
  }

  if(preferred_descriptor) {
    image.setAttribute('src', preferred_descriptor.url);
    if(preferred_descriptor.w)
      image.setAttribute('width', '' + preferred_descriptor.w);
    if(preferred_descriptor.h)
      image.setAttribute('height', '' + preferred_descriptor.h);
  }
}
