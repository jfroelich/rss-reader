// Functionality related to whether nodes appear in content

// These functions assume a document is "inert", such as one created by DOMParser, or from
// XMLHttpRequest.
//
// In an inert document, element style is lazily computed, and getComputedStyle is even more
// lazily computed. getComputedStyle is ridiculously slow. Combined with the fact that stylesheet
// information and style elements are filtered out in other modules, these functions are restricted
// to looking only at an element's own style attribute.
//
// In an inert document, offsetWidth and offsetHeight are not available. Therefore, this cannot use
// jQuery approach of testing if the offsets are 0. Which is unfortunate, because it is quite fast.


// TODO: consider a test that compares whether foreground color is too close to background color.
// This kind of applies only to text nodes.


import {assert} from "/src/assert.js";
import {parseInt10} from "/src/number.js";

// Checks whether an element is hidden because the element itself is hidden, or any of its
// ancestors are hidden.
// @param element {Element}
// @returns {Boolean} true if hidden
export function isHiddenElement(element) {
  assert(element instanceof Element);

  const doc = element.ownerDocument;
  const body = doc.body;


  // If a document does not have a body element, then assume it contains
  // no visible content, and therefore consider the element as hidden.
  if(!body) {
    return true;
  }

  // If the element is the body, then assume visible
  if(element === body) {
    return false;
  }

  // Ignore detached elements and elements outside of body
  // TODO: this should just be an if?
  assert(body.contains(element));

  // Quickly test the element itself before testing ancestors, with the hope
  // of avoiding checking ancestors
  if(isHiddenInlineElement(element)) {
    return true;
  }

  // TODO: the collection of ancestors should be delegated to getAncestors
  // in dom.js. This probably also entails changing the order of iteration
  // over the ancestors in the subsequent loop.

  // Walk bottom-up from after element to before body, recording the path
  const path = [];
  for(let e = element.parentNode; e && e !== body; e = e.parentNode) {
    path.push(e);
  }

  // Step backward along the path and stop upon finding the first hidden node
  // This is top down.
  for(let i = path.length - 1; i > -1; i--) {
    if(isHiddenInlineElement(path[i])) {
      return true;
    }
  }

  return false;
}

// Returns true if an element is hidden according to its inline style. Makes
// mostly conservative guesses and misses a few cases.
export function isHiddenInlineElement(element) {
  assert(element instanceof Element);

  // Special handling for MathML. <math> and its subelements do not contain
  // a style property in a parsed DOM (apparently). I don't know if this is
  // a bug or expected behavior. In any case, consider math elements and
  // descendants of math elements as always visible.
  // NOTE: closest includes the element itself
  if(element.closest('math')) {
    return false;
  }

  const style = element.style;

  // Some elements do not have a style prop.
  if(!style) {
    console.debug('no style prop:', element.outerHTML.substring(0, 100));
    return false;
  }

  // element.style only has a length if one or more explicit properties are set
  // elements are visible by default, so if no properties set then the element
  // cannot be hidden. Testing this helps avoid the more expensive tests
  // later in this function.
  if(!style.length) {
    return false;
  }

  return style.display === 'none' || style.visibility === 'hidden' ||
    isNearTransparent(element) || isOffscreen(element);
}

// Returns true if the element's opacity is too close to 0
// TODO: support all formats of the opacity property?
function isNearTransparent(element) {
  const opacity = parseFloat(element.style.opacity);
  return !isNaN(opacity) && opacity >= 0 && opacity <= 0.3;
}

// Returns true if the element is positioned off screen. Heuristic guess. Probably several false
// negatives, and a few false positives. The cost of guessing wrong is not too high. This is pretty
// inaccurate. Mostly just a mental note. Again, restricted to inert document context.
function isOffscreen(element) {
  if(element.style.position === 'absolute') {
    const left = parseInt10(element.style.left);
    if(!isNaN(left) && left < 0) {
      return true;
    }
  }

  return false;
}
