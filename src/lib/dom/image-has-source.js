// Returns true if the image element has at least one source, which could be a
// src attribute, a srcset attribute, or an associate picture element with one
// or more source elements that has a src or srcset attribute. This does not
// check whether the urls are syntactically correct, but this does check that an
// attribue value is not empty after trimming.

export function image_has_source(image) {
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

function has_value(element, attr_name) {
  const value = element.getAttribute(attr_name);
  return (value && value.trim()) ? true : false;
}
