(function(exports) {
'use strict';

function transform_responsive_images(doc) {
  if(!doc.body)
    return;
  const image_elements = doc.body.getElementsByTagName('img');
  for(const image_element of image_elements) {
    if(!image_has_valid_src(image_element) && image_has_srcset(image_element)) {
      transform_responsive_image(image_element);
    }
  }
}

// Return true if image has a valid src attribute value
function image_has_valid_src(image) {
  const min_url_length = 2;
  let src_value = image_element.getAttribute('src');
  if(src_value) {
    src_value = src_value.trim();
    return src_value.length > min_url_length && !src_value.includes(' '));
  }
}

// Return true if image has a srcset attribute value
function image_has_srcset(image) {
  const srcset_value = image_element.getAttribute('srcset');
  return srcset_value && srcset_value.trim();
}

function transform_responsive_image(image_element) {
  const srcset_value = image_element.getAttribute('srcset');

  // The try/catch is due to mistrust of third party code,
  // not because it is needed
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

exports.transform_responsive_images = transform_responsive_images;

}(this));
