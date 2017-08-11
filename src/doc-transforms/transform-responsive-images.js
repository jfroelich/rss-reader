// See license.md
'use strict';

// TODO: add to manifest.json
// TODO: insert in proper place in poll-entry before img dimensions
// TODO: create notes file, move the paragraph of notes from the set-img-dims
// notes page

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
  const previous_heigh = image_element.getAttribute('height');

  // Temp, monitoring transform
  console.log('Responsive image transform from', {
    'src': image_element.getAttribute('src'),
    'width': image_element.getAttribute('width'),
    'height': image_element.getAttribute('height')
  }, 'to', {
    'src': target_descriptor.url,
    'width': descriptor.w,
    'height': descriptor.h
  });

  // TODO: need to use parseInt from descriptor dimensions? Or are the
  // properties integers or strings containing only integers?

  image_element.setAttribute('src', target_descriptor.url);
  if(descriptor.w)
    image_element.setAttribute('width', descriptor.w);
  if(descriptor.h)
    image_element.setAttribute('height', descriptor.h);

}

this.transform_responsive_images = transform_responsive_images;

} // End file block scope
