import assert from "/src/common/assert.js";
import "/third-party/parse-srcset.js";

// Returns true if the image element has at least one source, which could be a src attribute, a
// srcset attribute, or an associate picture element with one or more source elements that has a
// src or srcset attribute.
//
// This does not check the validity of the values, such as whether an attribute that should contain
// a url contains a syntactically-correct url, but this does check that the value is not empty after
// trimming.
export function imageHasSource(image) {
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
    unwrapElement(figure);
  }

  const picture = image.closest('picture');
  if(picture) {
    const sources = picture.querySelectorAll('source');
    for(const source of sources) {
      source.remove();
    }

    // Picture can also be used as general container, so remove it but retain its children
    unwrapElement(picture);
  }

  image.remove();
}

function elementHasNonEmptyAttributeValueAfterTrim(element, attributeName) {
  const value = element.getAttribute(attributeName);
  return value && value.trim();
}

// Returns an array of descriptor objects. If the input is bad, or an error occurs, returns an
// empty array.
// @param srcset {Any} preferably a string, the value of a srcset attribute of an element
export function parseSrcsetWrapper(srcset) {
  const fallbackOutput = [];

  // Tolerate bad input for convenience
  if(typeof srcset !== 'string') {
    return fallbackOutput;
  }

  // Avoid parsing empty string
  if(!srcset) {
    return fallbackOutput;
  }

  // parseSrcset doesn't throw in the ordinary case, but avoid surprises
  let descriptors;
  try {
    descriptors = parseSrcset(srcset);
  } catch(error) {
    console.warn('Error parsing srcset ignored: ' + srcset);
    return fallbackOutput;
  }

  if(!Array.isArray(descriptors)) {
    return fallbackOutput;
  }

  return descriptors;
}



// Replace an element with its children. Special care is taken to add spaces if the operation would
// result in adjacent text nodes.
export function unwrapElement(element) {
  assert(element instanceof Element);
  assert(element.parentNode instanceof Element, 'Tried to unwrap orphaned element',
    element.outerHTML);

  const parentElement = element.parentNode;
  const previousSibling = element.previousSibling;
  const nextSibling = element.nextSibling;
  const firstChild = element.firstChild;
  const lastChild = element.lastChild;
  const TEXT = Node.TEXT_NODE;
  const frag = element.ownerDocument.createDocumentFragment();

  // Detach upfront for O(2) live dom ops, compared to O(n-children) otherwise
  element.remove();

  // Add leading padding
  if(previousSibling && previousSibling.nodeType === TEXT && firstChild &&
    firstChild.nodeType === TEXT) {
    frag.appendChild(element.ownerDocument.createTextNode(' '));
  }

  // Move children to fragment, maintaining order
  for(let node = firstChild; node; node = element.firstChild) {
    frag.appendChild(node);
  }

  // Add trailing padding
  if(lastChild && firstChild !== lastChild && nextSibling && nextSibling.nodeType === TEXT &&
    lastChild.nodeType === TEXT) {
    frag.appendChild(element.ownerDocument.createTextNode(' '));
  }

  // If nextSibling is undefined then insertBefore appends
  parentElement.insertBefore(frag, nextSibling);
}
