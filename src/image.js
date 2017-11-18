// Image element utilities

// TODO: after moving functions from dom.js, revisit what functions are named

import assert from "/src/assert.js";

// Returns true if the image element has at least one source, which could be a src attribute, a
// srcset attribute, or an associate picture element with one or more source elements that has a
// src or srcset attribute.
export function imageHasSource(image) {
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
export function imageHasValidSource(image) {
  assert(image instanceof Element);
  return isValidURLString(image.getAttribute('src'));
}

// Return true if image has a non-empty srcset attribute value
export function imageHasSrcset(image) {
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

// TODO: remove picture/source/figure/figcaption
export function removeImage(image) {
  image.remove();
}
