import assert from "/src/common/assert.js";
import "/third-party/parse-srcset.js";

// TODO: this library is almost exclusively used by filters, and should probably
// be moved there. The one exception I found at the moment was a call in an
// experimental library that will also be used by filters. So really this
// should just be filter-utils, located in the filters folder, and not in
// the more general common folder.

// Returns true if the image element has at least one source, which could be a
// src attribute, a srcset attribute, or an associate picture element with one
// or more source elements that has a src or srcset attribute.
//
// This does not check the validity of the values, such as whether an attribute
// that should contain a url contains a syntactically-correct url, but this does
// check that the value is not empty after trimming.
export function imageHasSource(image) {
  assert(image instanceof Element);

  // Alias the helper function name for brevity
  const has = elementHasNonEmptyAttributeValueAfterTrim;

  // Check if the image element itself has a source
  if(has(image, 'src') || has(image, 'srcset')) {
    return true;
  }

  // Check if the image element is part of a picture that has a descendant
  // source with a source
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

    // The figure may be used as a general container and contain content not
    // related to the image. Removing it would risk data loss so instead unwrap
    // it.
    unwrapElement(figure);
  }

  const picture = image.closest('picture');
  if(picture) {
    const sources = picture.querySelectorAll('source');
    for(const source of sources) {
      source.remove();
    }

    // Picture can also be used as general container, so remove it but retain
    // its children
    unwrapElement(picture);
  }

  image.remove();
}

function elementHasNonEmptyAttributeValueAfterTrim(element, attributeName) {
  const value = element.getAttribute(attributeName);
  return value && value.trim();
}

// Returns an array of descriptor objects. If the input is bad, or an error
// occurs, returns an empty array.
// @param srcset {Any} preferably a string, the value of a srcset attribute of
// an element
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



// Replace an element with its children. Special care is taken to add spaces if
// the operation would result in adjacent text nodes.
export function unwrapElement(element) {
  assert(element instanceof Element);
  assert(element.parentNode instanceof Element,
    'Tried to unwrap orphaned element', element.outerHTML);

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
  if(lastChild && firstChild !== lastChild && nextSibling &&
    nextSibling.nodeType === TEXT && lastChild.nodeType === TEXT) {
    frag.appendChild(element.ownerDocument.createTextNode(' '));
  }

  // If nextSibling is undefined then insertBefore appends
  parentElement.insertBefore(frag, nextSibling);
}



// Returns true if an element is hidden according to its inline style. Makes
// mostly conservative guesses because false positives carry a greater penalty
// than false negatives. In an inert document, element style is lazily computed,
// and getComputedStyle is even more lazily computed. getComputedStyle is
// ridiculously slow. Combined with the fact that stylesheet information and
// style elements are filtered out in other modules, these functions are
// restricted to looking only at an element's own style attribute.
//
// In an inert document, offsetWidth and offsetHeight are not available.
// Therefore, this cannot use jQuery approach of testing if the offsets are 0.
// Which is unfortunate, because it is quite fast.
export function isHiddenInlineElement(element) {
  assert(element instanceof Element);

  // Special handling for MathML. This absence of this case was previously the
  // source of a bug. <math> and its descendants do not contain a style
  // property. I do not know if this is a bug in the browser or expected
  // behavior. In any case, consider math elements and descendants of math
  // elements as always visible.
  //
  // In addition, because it is counterintuitive, I am pointing out that the
  // closest method includes a check against the element itself.
  //
  // TODO: I think I could encapsulate the above comment in a kind of helper
  // function that really clarifies this unique situation in a self-documenting
  // manner, rather than trying to explain it away in a comment
  // TODO: research whether this is actually a browser bug

  if(element.closest('math')) {
    return false;
  }

  const style = element.style;

  // NOTE: svg has a style property.

  // Some elements do not have a style prop. Generally these are math elements
  // or math descendants, but there is a special case for that above. This is a
  // catch all for other cases. I am logging occurrences because I am
  // interested in learning what other elements exhibit this behavior, but
  // so far only math-related elements do. In the absence of a style property
  // assume the element is visible.
  if(!style) {
    console.debug('Element missing style property',
      element.outerHTML.substring(0, 100));
    return false;
  }

  // element.style only has a length if one or more explicit properties are set.
  // Elements are visible by default. If no properties set then the element is
  // assumed to be visible. Testing this helps avoid the more expensive tests.
  if(!style.length) {
    return false;
  }

  return style.display === 'none' || style.visibility === 'hidden' ||
    isNearTransparent(style) || isOffscreen(element);
}

// Returns true if the element's opacity is too close to 0
// TODO: support other formats of the opacity property more accurately
function isNearTransparent(style) {
  if(style.opacity) {
    const opacityFloat = parseFloat(style.opacity);
    return !isNaN(opacityFloat) && opacityFloat <= 0.3;
  }
}

// Returns true if the element is positioned off screen. Heuristic guess.
// Probably several false negatives, and a few false positives. The cost of
// guessing wrong is not too high. This is pretty inaccurate. Mostly just a
// prototype of the idea of the test to use.
function isOffscreen(element) {
  if(element.style.position === 'absolute') {
    const left = parseInt(element.style.left, 10);
    if(!isNaN(left) && left < 0) {
      return true;
    }
  }

  return false;
}
