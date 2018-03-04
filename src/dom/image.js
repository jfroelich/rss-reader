import {element_unwrap} from '/src/dom/element-unwrap.js';

// Returns true if the image element has at least one source, which could be a
// src attribute, a srcset attribute, or an associate picture element with one
// or more source elements that has a src or srcset attribute. This does not
// check whether the urls are syntactically correct, but this does check that an
// attribue value is not empty after trimming.
export function image_has_source(image) {
  const has = element_attribute_not_empty_after_trim;  // local alias

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

// Removes an image element from its containing document along with some baggage
export function image_remove(image) {
  // This check is implicit in later checks. However, performing it redundantly
  // upfront here can avoid a substantial amount of processing. There is no
  // apparent value in removing an orphaned image, so silently cancel.
  if (!image.parentNode) {
    return;
  }

  const figure = image.closest('figure');
  if (figure) {
    // While it is tempting to simply remove the figure element itself and
    // thereby indirectly remove the image, this would risk data loss. The
    // figure may be used as a general container and contain content not related
    // to the image. The only content we know for certain that is related to
    // to the image in this case is the caption. There should only be one,
    // but this cannot assume well-formedness, so remove any captions.
    const captions = figure.querySelectorAll('figcaption');
    for (const caption of captions) {
      caption.remove();
    }

    element_unwrap(figure);
  }

  const picture = image.closest('picture');
  if (picture) {
    // Similar to figure, picture may be used as general container, so unwrap
    // rather than remove. The only thing we know that can be removed are the
    // source elements.
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
