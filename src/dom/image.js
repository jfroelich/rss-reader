// Image element utilities

import assert from "/src/utils/assert.js";
import {unwrap} from "/src/dom/utils.js";

// Returns true if the image element has at least one source, which could be a src attribute, a
// srcset attribute, or an associate picture element with one or more source elements that has a
// src or srcset attribute. This does not check the validity of the values of the attributes, just
// the presence of such attributes.
export function hasSource(image) {
  assert(image instanceof Element);

  if(image.hasAttribute('src') || image.hasAttribute('srcset')) {
    return true;
  }

  const picture = image.closest('picture');
  if(picture) {
    const sources = picture.getElementsByTagName('source');
    for(const source of sources) {
      if(source.hasAttribute('src') || source.hasAttribute('srcset')) {
        return true;
      }
    }
  }

  return false;
}

// Searches for and returns the corresponding figcaption element
export function findCaption(image) {
  assert(image instanceof Element);
  const figure = image.closest('figure');
  if(figure) {
    const captions = figure.getElementsByTagName('figcaption');
    if(captions && captions.length) {
      return captions[0];
    }
  }
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
