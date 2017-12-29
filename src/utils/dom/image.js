import assert from "/src/common/assert.js";
import unwrap from "/src/utils/dom/unwrap-element.js";

// Returns true if the image element has at least one source, which could be a src attribute, a
// srcset attribute, or an associate picture element with one or more source elements that has a
// src or srcset attribute.
//
// This does not check the validity of the values, such as whether an attribute that should contain
// a url contains a syntactically-correct url, but this does check that the value is not empty after
// trimming.
export function hasSource(image) {
  assert(image instanceof Element);

  // Alias the helper function name for brevity
  const has = elementHasNonEmptyAttributeValueAfterTrim;

  // Check if the image element itself has a source
  if(has(image, 'src') || has(image, 'srcset')) {
    return true;
  }

  // Check if the image element is part of a picture that has a descendant source with a source
  // attribute value
  const picture = image.closest('picture');
  if(picture) {
    const sources = picture.getElementsByTagName('source');
    for(const source of sources) {
      if(has(source, 'src') || has(source, 'srcset')) {
        return true;
      }
    }
  }

  return false;
}

// Removes an image along with any baggage
export function removeImage(image) {
  const figure = image.closest('figure');
  if(figure) {
    const captions = figure.querySelectorAll('figcaption');
    for(const caption of captions) {
      caption.remove();
    }

    // The figure may be used as a general container and contain content not related to the
    // image. Removing it would risk data loss so instead unwrap it.
    unwrap(figure);
  }

  const picture = image.closest('picture');
  if(picture) {
    const sources = picture.querySelectorAll('source');
    for(const source of sources) {
      source.remove();
    }

    // Picture can also be used as general container, so remove it but retain its children
    unwrap(picture);
  }

  image.remove();
}

function elementHasNonEmptyAttributeValueAfterTrim(element, attributeName) {
  const value = element.getAttribute(attributeName);
  return value && value.trim();
}
