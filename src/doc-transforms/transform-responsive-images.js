// See license.md
'use strict';

{ // Begin file block scope

function transform_responsive_images(doc) {

  if(!doc.body)
    return;

  const image_elements = doc.body.getElementsByTagName('img');
  for(const image_element of image_elements) {
    if(image_element_has_valid_src_attr(image_element))
      continue;

    let srcset_value = image_element.getAttribute('srcset');
    if(!srcset_value)
      continue;
    srcset_value = srcset_value.trim();
    if(!srcset_value)
      continue;

    transform_responsive_image(image_element, srcset_value);
  }
}

function image_element_has_valid_src_attr(image_element) {
  let src_value = image_element.getAttribute('src');
  if(!src_value)
    return false;
  src_value = src_value.trim();
  if(!src_value)
    return false;
  const min_url_length = 3;
  if(src_value.length < min_url_length)
    return false;
  if(src_value.includes(' '))
    return false;
  return true;
}

function transform_responsive_image(image_element, srcset_value) {
  let descriptors;

  // Try/catch is extra precaution due to use of 3rd party
  try {
    descriptors = parseSrcset(srcset_value);
  } catch(error) {

    // Temp, debugging
    console.log(error);

    return;
  }

  // extra precaution due to 3rd party
  if(!descriptors || !descriptors.length)
    return;

  // For the time being, the preference is whatever is first
  // For the time being, no special handling of descriptor.d
  // For the time being, both dimensions are not required
  let target_descriptor;
  for(const descriptor of descriptors) {
    if(descriptor.url && (descriptor.w || descriptor.h)) {
      target_descriptor = descriptor;
      break;
    }
  }

  if(!target_descriptor)
    return;

  const previous_src = image_element.getAttribute('src');
  const previous_width = image_element.getAttribute('width');
  const previous_height = image_element.getAttribute('height');

  // Temp, monitoring transform
  // NOTE: it is ok if these are null, that is normal given that it is the
  // whole reason I am looking at srcset.
  console.log('Responsive image transform from', {
    'src': previous_src,
    'width': previous_width,
    'height': previous_height
  }, 'to', {
    'src': target_descriptor.url,
    'width': target_descriptor.w,
    'height': target_descriptor.h
  });

  image_element.setAttribute('src', target_descriptor.url);
  if(target_descriptor.w)
    image_element.setAttribute('width', '' + target_descriptor.w);
  if(target_descriptor.h)
    image_element.setAttribute('height', '' + target_descriptor.h);
}

this.transform_responsive_images = transform_responsive_images;

} // End file block scope
