// Image element utilities

import assert from "/src/utils/assert.js";
import {unwrap} from "/src/dom/utils.js";
import {isValidURLString} from "/src/url/url-string.js";

// Returns true if the image element has at least one source, which could be a src attribute, a
// srcset attribute, or an associate picture element with one or more source elements that has a
// src or srcset attribute.
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

        // TEMP: tracing new functionality
        console.debug('found associated <source>', image.outerHTML, source.outerHTML);

        return true;
      }
    }
  }

  return false;
}

// Return true if image has a valid src attribute value
export function hasValidSource(image) {
  assert(image instanceof Element);
  return isValidURLString(image.getAttribute('src'));
}

// Return true if image has a non-empty srcset attribute value
export function hasSrcset(image) {
  assert(image instanceof Element);
  const imageSrcset = image.getAttribute('srcset');
  return imageSrcset && imageSrcset.trim();
}

// Searches for and returns the corresponding figcaption element
export function findCaption(image) {
  assert(image instanceof Element);
  let figcaption;
  const figure = image.closest('figure');
  if(figure) {
    figcaption = figure.querySelector('figcaption');
  }
  return figcaption;
}

export function removeImage(image) {
  const figure = image.closest('figure');
  if(figure) {
    const captions = figure.querySelectorAll('figcaption');
    for(const caption of captions) {
      caption.remove();
    }

    unwrap(figure);
  }

  const picture = image.closest('picture');
  if(picture) {
    const sources = picture.querySelectorAll('source');
    for(const source of sources) {
      source.remove();
    }

    unwrap(picture);
  }

  image.remove();
}
