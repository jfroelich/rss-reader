// Returns true if an element is hidden
export function is_hidden_inline(element) {
  if(element_input_is_hidden(element)) {
    return true;
  }

  const style = element.style;

  // Despite whatever the documentation states, the style property is sometimes
  // not initialized for certain elements such as <math>. This was encountered
  // around Chrome 65 as an uncaught exception.
  if (!style) {
    return false;
  }

  // The style object has a length property that is set to the number of inline
  // properties specified. If it is 0, that means that no inline style
  // properties are specified. I am not sure, but I think it is worth doing this
  // check because it potentially reduces the number of subsequent checks more
  // often than not.
  if (style.length < 1) {
    return false;
  }

  return style.display === 'none' || style.visibility === 'hidden' ||
      element_is_near_transparent(element) || element_is_offscreen(element);
}

// Return whether the element is <input type="hidden">
// TODO: consider element.matches('input[type="hidden"]')?
function element_input_is_hidden(element) {
  const name = element.localName;
  if(name === 'input') {
    const type = element.getAttribute('type');
    if(type && type.trim().toLowerCase() === 'hidden') {
      return true;
    }
  }
  return false;
}

// Returns true if the element's opacity is close to 0 or 0.
function element_is_near_transparent(element) {
  const style = element.style;

  // This time we know style is defined because we expect this to be called
  // exclusively from is_hidden_inline

  // We only care about the case when we are rather sure of transparency. If
  // we cannot determine then we assume the element is opaque and return false.

  // This check is a shortcut to try and avoid the cost of parseFloat.
  // Alternatively we could just let this case get caught with the isNaN check,
  // but that is after the parseFloat call.
  // TODO: but what about style.opacity 0? Is style.opacity a string or a
  // number? I think it is a string so this check is correct but I keep having
  // doubts, so one thing to do would be to explicit comment about it.
  // TODO: consider using the new CSSOM stuff if it is relevant
  if (!style.opacity) {
    return false;
  }

  // TODO: should this be a parameter instead of being hardcoded? In hindsight
  // I think that it is better to let the caller decide.
  const threshold = 0.3;

  // NOTE: parseFloat tolerates units.
  const opacity = parseFloat(style.opacity);
  return !isNaN(opacity) && opacity <= threshold;
}

// Returns true if the element is positioned off screen. Heuristic guess.
// Probably several false negatives, and a few false positives. The cost of
// guessing wrong is not too high. This is inaccurate.
function element_is_offscreen(element) {
  const style = element.style;
  if (style.position === 'absolute') {
    const left = parseInt(style.left, 10);
    if (!isNaN(left) && left < 0) {
      return true;
    }
  }

  return false;
}
