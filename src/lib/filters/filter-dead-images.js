import {has_source as image_has_source, remove as remove_image} from '/src/lib/dom/image.js';

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
