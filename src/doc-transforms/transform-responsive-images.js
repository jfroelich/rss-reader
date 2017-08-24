// See license.md
'use strict';

{ // Begin file block scope

function transform_responsive_images(doc) {
  if(!doc.body)
    return;
  const image_elements = doc.body.getElementsByTagName('img');
  for(const image_element of image_elements) {
    transform_image_if_responsive(image_element);
  }
}

function transform_image_if_responsive(image_element) {
  // If the image has a valid source then ignore it
  let src_value = image_element.getAttribute('src');
  if(src_value) {
    src_value = src_value.trim();
    const min_url_length = 2;
    if(src_value.length > min_url_length && !src_value.includes(' ')) {
      return;
    }
  }

  // If the image does not have a srcset then ignore it
  let srcset_value = image_element.getAttribute('srcset');
  if(!srcset_value)
    return;
  srcset_value = srcset_value.trim();
  if(!srcset_value)
    return;

  // Grab the descriptors. The try/catch is merely due to mistrust of 3rd party
  // and not because it is needed
  let descriptors;
  try {
    descriptors = parseSrcset(srcset_value);
  } catch(error) {
    return;
  }

  const descriptor = select_preferred_descriptor(descriptors);
  if(descriptor) {
    image_element.setAttribute('src', descriptor.url);
    if(descriptor.w)
      image_element.setAttribute('width', '' + descriptor.w);
    if(descriptor.h)
      image_element.setAttribute('height', '' + descriptor.h);
  }
}

// Return one of the descriptors from the array of descriptors
// For the time being, the preference is whatever is first
// For the time being, no special handling of descriptor.d
// For the time being, only one dimension is needed
// Eventually this should be smarter about picking one for viewport size
function select_preferred_descriptor(descriptors) {
  if(descriptors)
    for(const d of descriptors)
      if(d.url && (d.w || d.h))
        return d;
}

this.transform_responsive_images = transform_responsive_images;

} // End file block scope
