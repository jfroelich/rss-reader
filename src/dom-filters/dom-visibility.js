import {assert} from '/src/assert.js';

// Returns true if an element is hidden. This function is inexact and inspects
// various element properties to make a guess.
export function is_hidden_inline(element) {
  if (element.matches('input[type="hidden"]')) {
    return true;
  }

  const style = element.style;
  if (!style || !style.length) {
    return false;
  }

  // TODO: do not hardcode
  const min_opacity = new CSSUnitValue(0.3, 'number');
  return style.display === 'none' || style.visibility === 'hidden' ||
      element_is_near_transparent(element, min_opacity) ||
      element_is_offscreen(element);
}

// Returns true if the element's opacity is specified inline and less than the
// threshold.
// TODO: explicitly test
export function element_is_near_transparent(element, min_opacity) {
  assert(min_opacity instanceof CSSUnitValue);
  const opacity = element.attributeStyleMap.get('opacity');
  return opacity && opacity <= min_opacity;
}

// Returns true if the element is positioned off screen. Heuristic guess.
// Probably several false negatives, and a few false positives. The cost of
// guessing wrong is not too high. This is inaccurate.
// TODO: write tests that verify this behavior, this feels really inaccurate
export function element_is_offscreen(element) {
  const style = element.style;
  if (style && style.position === 'absolute') {
    const left = element.attributeStyleMap.get('left');
    if (left && left.value < 0) {
      return true;
    }
  }

  return false;
}
