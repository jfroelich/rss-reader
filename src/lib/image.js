import {element_unwrap} from '/src/lib/element-unwrap.js';

export function has_source(image) {
  const has = element_attribute_not_empty_after_trim;

  if (!(image instanceof Element)) {
    throw new TypeError('image not an element');
  }

  if (has(image, 'src') || has(image, 'srcset')) {
    return true;
  }

  const picture = image.closest('picture');
  if (picture) {
    const sources = picture.getElementsByTagName('source');
    for (const source of sources) {
      if (has(source, 'src') || has(source, 'srcset')) {
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

function element_attribute_not_empty_after_trim(element, attr_name) {
  const value = element.getAttribute(attr_name);
  return (value && value.trim()) ? true : false;
}
