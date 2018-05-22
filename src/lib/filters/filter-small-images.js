import * as imagemod from '/src/lib/image.js';

// TODO: merge filter_small_images and filter_large_images into a single filter
// filter_image_by_size
// Make the bin thresholds parameters instead of hardcoding

export function filter_small_images(document) {
  if (document.body) {
    const images = document.body.querySelectorAll('img');
    for (const image of images) {
      if (image_is_small(image)) {
        imagemod.remove(image);
      }
    }
  }
}

// TODO: merge this with image_is_large, make a function that does something
// like image_bin_size, and returns small or large or other. Then deprecate
// image_is_small and image_is_large
function image_is_small(image) {
  const width_string = image.getAttribute('width');
  if (!width_string) {
    return false;
  }

  const height_string = image.getAttribute('height');
  if (!height_string) {
    return false;
  }

  const width_int = parseInt(width_string, 10);
  if (isNaN(width_int)) {
    return false;
  }

  const height_int = parseInt(height_string, 10);
  if (isNaN(height_int)) {
    return false;
  }

  if (width_int < 3) {
    return false;
  }

  if (height_int < 3) {
    return false;
  }

  if (width_int < 33 && height_int < 33) {
    return true;
  }

  return false;
}
