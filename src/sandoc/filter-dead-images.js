import * as dom_utils from '/src/dom/dom.js';

// An image is 'dead' if it is unfetchable. One reason that an image is
// unfetchable is when an image does not have an associated url.
export function filter_dead_images(document) {
  if (document.body) {
    const images = document.body.querySelectorAll('img');
    for (const image of images) {
      if (!dom_utils.image_has_source(image)) {
        dom_utils.remove_image(image);
      }
    }
  }
}
