import {image_has_source} from '/src/dom/image-has-source.js';
import {remove_image} from '/src/dom/remove-image.js';

// An image is 'dead' if it is unfetchable. One reason that an image is
// unfetchable is when an image does not have an associated url.
export function filter_dead_images(document) {
  if (document.body) {
    const images = document.body.querySelectorAll('img');
    for (const image of images) {
      if (!image_has_source(image)) {
        remove_image(image);
      }
    }
  }
}
