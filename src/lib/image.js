import {element_unwrap} from '/src/lib/element-unwrap.js';

export function has_source(image) {
  if (!(image instanceof Element)) {
    throw new TypeError('image not an element');
  }

  if (has_value(image, 'src') || has_value(image, 'srcset')) {
    return true;
  }

  const picture = image.closest('picture');
  if (picture) {
    const sources = picture.getElementsByTagName('source');
    for (const source of sources) {
      if (has_value(source, 'src') || has_value(source, 'srcset')) {
        return true;
      }
    }
  }

  return false;
}

export function remove(image) {
  if (!image.parentNode) {
    return;
  }

  const figure = image.parentNode.closest('figure');
  if (figure) {
    const captions = figure.querySelectorAll('figcaption');
    for (const caption of captions) {
      caption.remove();
    }

    element_unwrap(figure);
  }

  const picture = image.parentNode.closest('picture');
  if (picture) {
    const sources = picture.querySelectorAll('source');
    for (const source of sources) {
      source.remove();
    }

    element_unwrap(picture);
  }

  image.remove();
}

function has_value(element, attr_name) {
  const value = element.getAttribute(attr_name);
  return (value && value.trim()) ? true : false;
}
