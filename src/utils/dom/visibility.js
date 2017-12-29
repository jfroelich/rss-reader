import assert from "/src/common/assert.js";

// Returns true if an element is hidden according to its inline style. Makes mostly conservative
// guesses because false positives carry a greater penalty than false negatives.
// In an inert document, element style is lazily computed, and getComputedStyle is even more
// lazily computed. getComputedStyle is ridiculously slow. Combined with the fact that stylesheet
// information and style elements are filtered out in other modules, these functions are restricted
// to looking only at an element's own style attribute.
// In an inert document, offsetWidth and offsetHeight are not available. Therefore, this cannot use
// jQuery approach of testing if the offsets are 0. Which is unfortunate, because it is quite fast.
export function isHiddenInlineElement(element) {
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

  // NOTE: svg has a style property.

  // Some elements do not have a style prop. Generally these are math elements or math descendants,
  // but there is a special case for that above. This is a catch all for other cases. I am logging
  // occurrences because I am interested in learning what other elements exhibit this behavior, but
  // so far only math-related elements do. In the absence of a style property assume the element
  // is visible.
  if(!style) {
    console.debug('Element missing style property', element.outerHTML.substring(0, 100));
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
// TODO: support other formats of the opacity property more accurately
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
    const left = parseInt(element.style.left, 10);
    if(!isNaN(left) && left < 0) {
      return true;
    }
  }

  return false;
}
