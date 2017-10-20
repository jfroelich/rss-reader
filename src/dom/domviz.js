'use strict';

const domviz = {};

// Returns true if an element is hidden. An element is hidden if any of its
// ancestor nodes are hidden, or it is hidden due to its style properties.
// TODO: deprecate, merge with element.js function element_is_hidden
// TODO: look into whether inline style is computed. E.g. if parent is hidden,
// then does style of element itself inherit when accessed via style prop?
// Pretty sure no inheritance but I should write an explicit test.
// NOTE: only looks at inline style, assumes document is inert so cannot use
// offset width/height, also inspects parents (up to body), does not run the
// full range of tricks for hiding nodes (e.g occlusion/clipping/out of view),
// does not check if foreground color too similar to background color
domviz.element_is_hidden = function(element) {
  const doc = element.ownerDocument;
  const body = doc.body;
  // Without a body, assume everything is hidden
  if(!body)
    return true;

  // If body assume visible
  if(element === body)
    return false;

  // Ignore detached elements and elements outside of body
  // TODO: change to ASSERT
  if(!body.contains(element))
    throw new TypeError('element is not a descendant of body');

  // Quickly test the element itself before testing ancestors, with the hope
  // of avoiding checking ancestors
  if(domviz.is_inline_hidden_element(element))
    return true;

  // Walk bottom-up from after element to before body, recording the path
  const path = [];
  for(let e = element.parentNode; e && e !== body; e = e.parentNode)
    path.push(e);

  // Step backward along the path and stop upon finding the first hidden node
  for(let i = path.length - 1; i > -1; i--)
    if(domviz.is_inline_hidden_element(path[i]))
      return true;
  return false;
};

// TODO: rename
domviz.is_inline_hidden_element = function(element) {
  return element && element.style && element.style.length &&
    (element.style.display === 'none' ||
    element.style.visibility === 'hidden' ||
    (element.style.opacity &&
      parseFloat(element.style.opacity) < 0.3));
};
