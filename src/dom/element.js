'use strict';

// Returns true if the first parameter is of type Element
function element_is_element(element) {
  return element instanceof Element;
}

// Returns true if the given name is a valid name for an element
function element_is_valid_name(name) {
  return typeof name === 'string' && name.length && !name.includes(' ');
}

// Copies the attributes of an element to another element. Overwrites any
// existing attributes in the other element.
// @param from_element {Element}
// @param to_element {Element}
// @throws {Error} if either element is not an Element
// @returns void
function element_copy_attributes(from_element, to_element) {
  // Use getAttributeNames in preference to element.attributes due to
  // performance issues with element.attributes, and to allow unencumbered use
  // of the for..of syntax (I had issues with NamedNodeMap and for..of).
  const names = from_element.getAttributeNames();
  for(const name of names) {
    const value = from_element.getAttribute(name);
    to_element.setAttribute(name, value);
  }
}

// Recursive
// TODO: move to filter helpers?
function node_is_leaf(node) {
  switch(node.nodeType) {
    case Node.ELEMENT_NODE:
      if(element_is_leaf_exception(node))
        return false;
      for(let child = node.firstChild; child; child = child.nextSibling)
        if(!node_is_leaf(child))
          return false;
      break;
    case Node.TEXT_NODE:
      return !node.nodeValue.trim();
    case Node.COMMENT_NODE:
      return true;
    default:
      return false;
  }

  return true;
}

function element_is_leaf_exception(element) {
  const exceptions = [
    'area', 'audio', 'base', 'col', 'command', 'br', 'canvas', 'col', 'hr',
    'iframe', 'img', 'input', 'keygen', 'meta', 'nobr', 'param', 'path',
    'source', 'sbg', 'textarea', 'track', 'video', 'wbr'
  ];
  return exceptions.includes(element.localName);
}



// Only looks at inline style.
// Returns {'width': int, 'height': int} or undefined
function element_get_dimensions(element) {

  // Accessing element.style is a performance heavy operation sometimes, so
  // try and avoid calling it.
  if(!element.hasAttribute('style'))
    return;

  // TODO: support percents and other strange values?

  const dimensions = {};
  const radix = 10;
  dimensions.width = parseInt(element.style.width, radix);
  dimensions.height = parseInt(element.style.height, radix);

  // TODO: this could be written more clearly
  return (isNaN(dimensions.width) || isNaN(dimensions.height)) ?
    undefined : dimensions;
}

// TODO: this could use some cleanup or at least some clarifying comments
function element_fade(element, duration_secs, delay_secs) {
  return new Promise(function executor(resolve, reject) {
    const style = element.style;
    if(style.display === 'none') {
      style.display = '';
      style.opacity = '0';
    }

    if(!style.opacity) {
      style.opacity = style.display === 'none' ? '0' : '1';
    }

    element.addEventListener('webkitTransitionEnd', resolve, {'once': true});

    // property duration function delay
    style.transition = `opacity ${duration_secs}s ease ${delay_secs}s`;
    style.opacity = style.opacity === '1' ? '0' : '1';
  });
}
