export function filter_large_images(document) {
  if (document.body) {
    const images = document.body.querySelectorAll('img');
    for (const image of images) {
      if (image_is_large(image)) {
        image.removeAttribute('width');
        image.removeAttribute('height');
      }
    }
  }
}

function image_is_large(image) {
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
  } else if (width_int > 1000) {
    return true;
  }

  const height_int = parseInt(height_string, 10);
  if (isNaN(height_int)) {
    return false;
  } else if (height_int > 1000) {
    return true;
  }

  return false;
}
