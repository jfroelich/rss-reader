// TODO: there is no real need to restrict this to body, that is pedantic. even
// though several other filters do restrict to body, here it does not provide
// much benefit, so I think it is ok to be unconventional. rather, the
// primary convention should just be simplicity, not repetition of approach

export function image_size_large_filter(document) {
  if (document.body) {
    const images = document.body.querySelectorAll('img');
    for (const image of images) {
      if (image_is_size_large(image)) {
        image.removeAttribute('width');
        image.removeAttribute('height');
      }
    }
  }
}

function image_is_size_large(image) {
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
