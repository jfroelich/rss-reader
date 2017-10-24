'use strict';

// Returns true if an element is hidden. An element is hidden if any of its
// ancestor nodes are hidden, or it is hidden due to its inline style.
// Only looks at inline styles, assumes document is inert so cannot use
// offset width/height, also inspects parents (up to body), does not run the
// full range of tricks for hiding nodes (e.g occlusion/clipping/out of view),
// does not check if foreground color too similar to background color
function visibility_element_is_hidden(element) {
  const doc = element.ownerDocument;
  const body = doc.body;

  // Without a body, assume everything is hidden
  if(!body) {
    return true;
  }

  // If the element is the body, then assume visible
  if(element === body) {
    return false;
  }

  // Ignore detached elements and elements outside of body
  console.assert(body.contains(element));

  // Quickly test the element itself before testing ancestors, with the hope
  // of avoiding checking ancestors
  if(visibility_element_is_hidden_inline(element)) {
    return true;
  }

  // Walk bottom-up from after element to before body, recording the path
  // TODO: delegate to get ancestors in element.js, and change later loop
  // to start from body?
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

  // element.style only has a length if one or more inline properties are set
  // if no properties set then cannot be hidden inline
  if(!element.style.length) {
    return false;
  }

  if(element.style.display === 'none') {
    return true;
  }

  if(element.style.visibility === 'hidden') {
    return true;
  }

  const opacity = parseFloat(element.style.opacity);
  if(!isNaN(opacity) && opacity < 0.3) {
    return true;
  }

  // Heuristic guess. May be false positive but rarely.
  if(element.style.position === 'absolute') {
    const radix = 10;
    const left = parseInt(element.style.left, radix);
    if(!isNaN(left) && left < 0) {
      return true;
    }
  }

  return false;
}
