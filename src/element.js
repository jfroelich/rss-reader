// Functions related to DOM elements

// Returns true if an element is hidden
// TODO: rename this to element_is_hidden_inline, and create
// a more general function that inspects ancestors too
// See what I did in domvis pagination lib, move that into here
function element_is_hidden(element) {
  'use strict';
  return element.hasAttribute('style') &&
    (element.style.display === 'none' ||
     element.style.visibility === 'hidden' ||
     (element.style.position === 'absolute' &&
      parseInt(element.style.left, 10) < 0));
}

// Only looks at inline style.
// Returns {'width': int, 'height': int} or undefined
function element_get_dimensions(element) {
  'use strict';

  if(!element.hasAttribute('style'))
    return;

  // TODO: percents?

  const dimensions = {};
  const radix = 10;
  dimensions.width = parseInt(element.style.width, radix);
  dimensions.height = parseInt(element.style.height, radix);
  return (isNaN(dimensions.width) || isNaN(dimensions.height)) ?
    undefined : dimensions;

}
