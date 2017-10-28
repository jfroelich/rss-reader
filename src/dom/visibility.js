'use strict';

// Returns true if an element, or any of its ancestors, is hidden.
// @param element {Element}
function visibility_element_is_hidden(element) {

  console.assert(element instanceof Element);

  const doc = element.ownerDocument;
  const body = doc.body;

  // NOTE: in an inert document, element style is lazily computed, and
  // getComputedStyle is even more lazily computed. getComputedStyle is
  // ridiculously slow. Combined with the fact that stylesheet information
  // and style elements are filtered out in other areas, this is restricted
  // to looking at the inline style (the style attribute).

  // NOTE: in an inert document, offsetWidth and offsetHeight are not
  // available. Therefore, this cannot use jQuery approach of testing if the
  // offsets are 0. Which is unfortunate, because it is quite fast.

  // TODO: consider a test that compares whether foreground color is too
  // close to background color. This kind of applies only to text nodes.

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
  // TODO: this is a weak assert. Decide if it should be a strong assert
  console.assert(body.contains(element));

  // Quickly test the element itself before testing ancestors, with the hope
  // of avoiding checking ancestors
  if(visibility_element_is_hidden_inline(element)) {
    return true;
  }

  // TODO: the collection of ancestors should be delegated to a function
  // in element.js. This probably also entails changing the order of iteration
  // over the ancestors in the subsequent loop.

  // Walk bottom-up from after element to before body, recording the path
  const path = [];
  for(let e = element.parentNode; e && e !== body; e = e.parentNode) {
    path.push(e);
  }

  // Step backward along the path and stop upon finding the first hidden node
  // This is top down.
  for(let i = path.length - 1; i > -1; i--) {
    if(visibility_element_is_hidden_inline(path[i])) {
      return true;
    }
  }

  return false;
}

// Returns true if an element is hidden according to its inline style. Makes
// mostly conservative guesses and misses a few cases.
function visibility_element_is_hidden_inline(element) {
  console.assert(element instanceof Element);

  // BUG: seeing cannot read length of undefined in console. My understanding
  // is that all elements have a style property. So perhaps this is not
  // getting called on an element? But the previous assert never fails, element
  // is an instanceof an element. Or does it? Check again.

  // NOTE: this bug only arose after recent changes to poll_entry and after
  // adding brackets to all single line if/for blocks

  const style = element.style;

  // TEMP: for some reason this assertion fails
  console.assert(style);

  // TEMP: researching bug
  if(!style) {
    console.debug('styleless element', element.innerHTML.substring(0, 50));
    return false;
  }

  // element.style only has a length if one or more explicit properties are set
  // elements are visible by default, so if no properties set then the element
  // cannot be hidden. Testing this helps avoid the more expensive tests
  // later in this function.
  if(!style.length) {
    return false;
  }

  return style.display === 'none' ||
    style.visibility === 'hidden' ||
    visibility_is_near_transparent(element) ||
    visibility_is_offscreen(element);
}

// Returns true if the element's opacity is too close to 0
// TODO: support all formats of the opacity property?
function visibility_is_near_transparent(element) {
  const opacity = parseFloat(element.style.opacity);
  return !isNaN(opacity) && opacity >= 0 && opacity <= 0.3;
}

// Returns true if the element is positioned off screen.
// Heuristic guess. Probably several false negatives, and a few false
// positives. The cost of guessing wrong is not too high.
// This is pretty inaccurate. Mostly just a mental note.
// Again, restricted to inert document context.
function visibility_is_offscreen(element) {
  if(element.style.position === 'absolute') {
    const radix = 10;
    const left = parseInt(element.style.left, radix);
    if(!isNaN(left) && left < 0) {
      return true;
    }
  }

  return false;
}
