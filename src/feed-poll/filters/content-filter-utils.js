import '/third-party/parse-srcset.js';

// Returns true if the image element has at least one source, which could be:
// * a src attribute,
// * a srcset attribute,
// * or an associate picture element with one or more source elements that has a
// src or srcset attribute.
//
// This does not check whether the urls are syntactically correct, but this does
// check that the value is not empty after trimming.
export function imageHasSource(image) {
  assert(image instanceof Element);

  // Alias the helper function name for brevity
  const has = elementHasNonEmptyAttributeValueAfterTrim;

  // Check if the image element itself has a source
  if (has(image, 'src') || has(image, 'srcset')) {
    return true;
  }

  // Check if the image element is part of a picture that has a descendant
  // source with a source attribute value
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
export function removeImage(image) {
  // This check is implicit in later checks. However, performing it redundantly
  // upfront here can avoid a substantial amount of processing. There is no
  // clear value in removing an orphaned node, so silently cancel.
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

    unwrapElement(figure);
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

    unwrapElement(picture);
  }

  image.remove();
}

function elementHasNonEmptyAttributeValueAfterTrim(element, attributeName) {
  const value = element.getAttribute(attributeName);
  return (value && value.trim()) ? true : false;
}

// Parses a srcset value into an array of descriptors. If the input is bad, or
// an error occurs, or no descriptors found, returns an empty array. This
// function makes use of third-party code.
// @param srcset {Any} preferably a string, the value of a srcset attribute of
// an element
export function parseSrcsetWrapper(srcset) {
  const fallbackOutput = [];

  // Tolerate bad input for convenience
  if (typeof srcset !== 'string') {
    return fallbackOutput;
  }

  // Avoid parsing empty string
  if (!srcset) {
    return fallbackOutput;
  }

  // parseSrcset doesn't throw in the ordinary case, but avoid surprises
  let descriptors;
  try {
    descriptors = parseSrcset(srcset);
  } catch (error) {
    console.warn(error);
    return fallbackOutput;
  }

  if (!Array.isArray(descriptors)) {
    return fallbackOutput;
  }

  return descriptors;
}

// Replace an element with its child nodes. Special care is taken to add
// whitespace if the operation would result in adjacent text nodes. The element
// should be attached (it should be a node, or a descendant of a node, that is
// in the document).
export function unwrapElement(element) {
  assert(element instanceof Element);

  // An orphaned node is any parentless node. An orphaned node is obviously
  // detached from the document, since we know that all attached nodes always
  // have a parent. There is no benefit to unwrapping orphans. This is similar
  // to calling `element.remove(); element.remove();`.
  //
  // Although attempting to unwrap an orphaned node should probably represent a
  // programming error, just exit early, silently. I do not anticipate this
  // silence causing later confusion because unwrapping a detached node is
  // effectively a no-op in relation to a document.
  if (!element.parentNode) {
    return;
  }

  // Cache stuff prior to removal
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
  if (previousSibling && previousSibling.nodeType === TEXT && firstChild &&
      firstChild.nodeType === TEXT) {
    frag.appendChild(element.ownerDocument.createTextNode(' '));
  }

  // Move children to fragment, maintaining order
  for (let node = firstChild; node; node = element.firstChild) {
    frag.appendChild(node);
  }

  // Add trailing padding
  if (lastChild && firstChild !== lastChild && nextSibling &&
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
// In an inert document, offsetWidth and offsetHeight are unknown and cannot
// be used.
export function isHiddenInlineElement(element) {
  assert(element instanceof Element);

  // Special handling for MathML. This absence of this case was previously the
  // source of a bug. <math> and its descendants do not contain a style
  // property. I do not know if this is a bug in Chrome or expected behavior. In
  // any case, consider math elements and descendants of math elements as always
  // visible.
  //
  // In addition, because it is counterintuitive, I am pointing out that the
  // closest method includes a check against the element itself.
  //
  // TODO: I think I could encapsulate the above comment in a kind of helper
  // function that really clarifies this unique situation in a self-documenting
  // manner, rather than trying to explain it away in a comment
  // TODO: research whether this is actually a browser bug

  if (element.closest('math')) {
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
  if (!style) {
    console.debug(
        'Element missing style property', element.outerHTML.substring(0, 100));
    return false;
  }

  // element.style only has a length if one or more explicit properties are set.
  // Elements are visible by default. If no properties set then the element is
  // assumed to be visible. Testing this helps avoid the more expensive tests.
  if (!style.length) {
    return false;
  }

  return style.display === 'none' || style.visibility === 'hidden' ||
      isNearTransparent(style) || isOffscreen(element);
}

// Returns true if the element's opacity is too close to 0
// TODO: support other formats of the opacity property more accurately
function isNearTransparent(style) {
  if (style.opacity) {
    const opacityFloat = parseFloat(style.opacity);
    return !isNaN(opacityFloat) && opacityFloat <= 0.3;
  }
}

// Returns true if the element is positioned off screen. Heuristic guess.
// Probably several false negatives, and a few false positives. The cost of
// guessing wrong is not too high. This is pretty inaccurate. Mostly just a
// prototype of the idea of the test to use.
function isOffscreen(element) {
  if (element.style.position === 'absolute') {
    const left = parseInt(element.style.left, 10);
    if (!isNaN(left) && left < 0) {
      return true;
    }
  }

  return false;
}

function assert(value, message) {
  if (!value) throw new Error(message || 'Assertion error');
}
