// Lib for working with responsive techniques in html documents

// Dependencies:
// assert.js
// image.js

/*
Misc notes:
TODO: consider merging with lazy image transform?
The srcset image might be different. That would be bad. On the other hand, any
srcset img present means it is suitable as the src of the image, which means
it must be pluggable. But ... as each image can be entirely different, that
fundamentally means I have to use the srcset instead of the src, and should
be swapping the src attribute. That kind of goes against the grain. So...
maybe it really is only a function of transform lazy images. Transform lazy
should not only look at non-src with viable alternate attribute, it should also
look at missing or empty src attribute with but with srcset.

Responsively loaded images are not truly lazy though. They are just responsive.
That basically suggests I should have a wholly separate transformation. So it
would make sense to create a response-image-filter function, that looks for
images where src is missing/empty, and but srcset is present, and then chooses
one of the srcset descriptors and substitutes its url, and its dimensions,
into the src and dimension attributes of the image.

It should probably run before the lazy image transform.
*/

// @param doc {Document} the document to modify
function responsive_transform_document(doc) {
  'use strict';
  ASSERT(doc);
  if(!doc.body)
    return;
  const image_elements = doc.body.getElementsByTagName('img');
  for(const image_element of image_elements) {
    if(!image_has_valid_src(image_element) && image_has_srcset(image_element)) {
      responsive_transform_image(image_element);
    }
  }
}


function responsive_transform_image(image_element) {
  'use strict';
  const srcset_value = image_element.getAttribute('srcset');

  // The try/catch is due to mistrust of third party code,
  // not because it is needed
  let descriptors;
  try {
    descriptors = parseSrcset(srcset_value);
  } catch(error) {
    return;
  }

  // Extra check due to mistrust of third party code
  if(!descriptors)
    return;

  // Choose one of the descriptors from the array of descriptors
  // For the time being, the preference is whatever is first
  // For the time being, no special handling of descriptor.d
  // For the time being, only one dimension is needed
  let preferred_descriptor;
  for(const descriptor of descriptors) {
    if(descriptor.url && (descriptor.w || descriptor.h)) {
      preferred_descriptor = descriptor;
      break;
    }
  }

  if(preferred_descriptor) {
    image_element.setAttribute('src', preferred_descriptor.url);
    if(preferred_descriptor.w)
      image_element.setAttribute('width', '' + preferred_descriptor.w);
    if(preferred_descriptor.h)
      image_element.setAttribute('height', '' + preferred_descriptor.h);
  }
}
