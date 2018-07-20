import assert from '/src/assert.js';

// TODO: learn and consider cssom

// Returns true if an element is hidden according to its inline style
export function element_is_hidden_inline(element) {
  // It is an error to call this on something other than an element
  assert(element instanceof Element);
  // offset width and height are unreliable in an inert document so this must
  // rely on style. style may be undefined for elements such as <math>, in which
  // case elements are presumed visible. style.length is 0 when no inline
  // properties set.
  const style = element.style;
  return style && style.length &&
      (style.display === 'none' || style.visibility === 'hidden' ||
       element_is_near_transparent(style) || element_is_offscreen(style));
}

// Returns true if the element's opacity is too close to 0
// Throws error is style is undefined
function element_is_near_transparent(style) {
  if (style.opacity) {
    const visibility_threshold = 0.3;
    const opacity_f = parseFloat(style.opacity);
    return !isNaN(opacity_f) && opacity_f <= visibility_threshold;
  }
}

// Returns true if the element is positioned off screen. Heuristic guess.
// Probably several false negatives, and a few false positives. The cost of
// guessing wrong is not too high. This is inaccurate.
function element_is_offscreen(style) {
  if (style.position === 'absolute') {
    const left = parseInt(style.left, 10);
    if (!isNaN(left) && left < 0) {
      return true;
    }
  }

  return false;
}
