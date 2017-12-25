import assert from "/src/utils/assert.js";
import parseInt10 from "/src/utils/parse-int-10.js";

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

// Checks whether an element is hidden because the element itself is hidden, or any of its
// ancestors are hidden.
// @param element {Element}
// @returns {Boolean} true if hidden
export function isHiddenElement(element) {
  assert(element instanceof Element);
  const doc = element.ownerDocument;

  // If a document does not have a body element, then assume it contains no visible content, and
  // therefore consider the element as hidden.
  if(!doc.body) {
    return true;
  }

  // If the element is the body, then assume visible
  if(element === doc.body) {
    return false;
  }

  // Assume all elements outside the body are not part of visible content
  if(!doc.body.contains(element)) {
    return true;
  }

  // Test the element itself with the hope of avoiding ancestors path analysis
  if(isHiddenInlineElement(element)) {
    return true;
  }

  // Walk bottom-up from after element to before body, recording the path. Exclude the element
  // itself from the path so it is not checked again.
  const path = [];
  for(let e = element.parentNode; e && e !== doc.body; e = e.parentNode) {
    path.push(e);
  }

  // The path is empty when the element is immediately under the body. Since we already checked
  // the element, and do not plan to check the body, we're done. This empty check avoids going
  // below the lower bound index of the path in the next loop.
  if(!path.length) {
    return false;
  }

  // Step backward along the path and stop upon finding the first hidden node. This does not
  // re-test the element because it is not in the path. We know the path is not empty because of
  // the above check, so it is safe to start from the last element in the path.
  for(let i = path.length - 1; i >=0; i--) {
    if(isHiddenInlineElement(path[i])) {
      return true;
    }
  }

  return false;
}

// Returns true if an element is hidden according to its inline style. Makes mostly conservative
// guesses because false positives carry a greater penalty than false negatives.
export function isHiddenInlineElement(element) {
  // This is a public function so do not trust input
  assert(element instanceof Element);

  // Special handling for MathML. This absence of this case was previously the source of a bug.
  // <math> and its descendants do not contain a style property. I do not know if this is a bug or
  // expected behavior. In any case, consider math elements and descendants of math elements as
  // always visible. In addition, because it is counterintuitive, I am pointing out that the
  // closest method includes a check against the element itself.
  if(element.closest('math')) {
    return false;
  }

  const style = element.style;

  // NOTE: svg does have a style property.

  // Some elements do not have a style prop. Generally these are math elements or math descendants,
  // but there is a special case for that above. This is a catch all for other cases. I am logging
  // occurrences because I am interested in learning what other elements exhibit this behavior, but
  // so far only math-related elements do. In the absence of a style property assume the element
  // is visible.
  if(!style) {
    console.debug('no style prop:', element.outerHTML.substring(0, 100));
    return false;
  }

  // element.style only has a length if one or more explicit properties are set. Elements are
  // visible by default. If no properties set then the element is assumed to be visible. Testing
  // this helps avoid the more expensive tests.
  if(!style.length) {
    return false;
  }

  return style.display === 'none' || style.visibility === 'hidden' ||
    isNearTransparent(style) || isOffscreen(element);
}

// Returns true if the element's opacity is too close to 0
// TODO: support other formats of the opacity property
function isNearTransparent(style) {
  if(style.opacity) {
    const opacityFloat = parseFloat(style.opacity);
    return !isNaN(opacityFloat) && opacityFloat <= 0.3;
  }
}

// Returns true if the element is positioned off screen. Heuristic guess. Probably several false
// negatives, and a few false positives. The cost of guessing wrong is not too high. This is pretty
// inaccurate. Mostly just a prototype of the idea of the test to use.
function isOffscreen(element) {
  if(element.style.position === 'absolute') {
    const left = parseInt10(element.style.left);
    if(!isNaN(left) && left < 0) {
      return true;
    }
  }

  return false;
}
