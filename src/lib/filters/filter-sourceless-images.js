import {has_source as image_has_source, remove as remove_image} from '/src/lib/image.js';

// Removes images without src attribute
export function filter_sourceless_images(document) {
  if (document.body) {
    const images = document.body.querySelectorAll('img');
    for (const image of images) {
      if (!image_has_source(image)) {
        remove_image(image);
      }
    }
  }
}
