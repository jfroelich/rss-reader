// Lib for working with responsive techniques in html documents
'use strict';

// Dependencies:
// assert.js
// image.js
// srcset.js

// Scans the input document for responsive images and modifies those image
// elements in place
// @param doc {Document} the document to analyze
function response_image_filter(doc) {
  ASSERT(doc);

  // Analysis restricted to body descendants
  if(!doc.body)
    return;

  const images = doc.body.getElementsByTagName('img');
  for(const image of images) {
    if(!image_has_valid_source(image) && image_has_srcset(image)) {
      responsive_image_filter_image(image);
    }
  }
}

function responsive_image_filter_image(image) {
  const srcset_value = image.getAttribute('srcset');
  const descriptors = srcset_parse_from_string(srcset_value);

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

    // TODO: remove the srcset attribute?
  }
}
