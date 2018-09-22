import * as image_element_utils from '/src/image-element-utils/image-element-utils.js';

// An image is 'dead' if it is unfetchable. One reason that an image is
// unfetchable is when an image does not have an associated url.
export function filter_dead_images(document) {
  if (document.body) {
    const images = document.body.querySelectorAll('img');
    for (const image of images) {
      if (!image_element_utils.image_has_source(image)) {
        image_element_utils.remove_image(image);
      }
    }
  }
}
