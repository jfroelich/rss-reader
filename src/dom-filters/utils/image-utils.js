import {unwrap_element} from '/src/dom-filters/utils/unwrap-element.js';

// Returns true if the image element has at least one source
export function image_has_source(image) {
  if (has_attr_val(image, 'src') || has_attr_val(image, 'srcset')) {
    return true;
  }

  const picture = image.closest('picture');
  if (picture) {
    const sources = picture.getElementsByTagName('source');
    for (const source of sources) {
      if (has_attr_val(source, 'src') || has_attr_val(source, 'srcset')) {
        return true;
      }
    }
  }

  return false;
}

function has_attr_val(element, attr_name) {
  const value = element.getAttribute(attr_name);
  return (value && value.trim()) ? true : false;
}

// Detach an image along with some of its dependencies
export function remove_image(image) {
  if (!image.parentNode) {
    return;
  }

  const figure = image.parentNode.closest('figure');
  if (figure) {
    const captions = figure.querySelectorAll('figcaption');
    for (const caption of captions) {
      caption.remove();
    }

    unwrap_element(figure);
  }

  const picture = image.parentNode.closest('picture');
  if (picture) {
    const sources = picture.querySelectorAll('source');
    for (const source of sources) {
      source.remove();
    }

    unwrap_element(picture);
  }

  image.remove();
}
