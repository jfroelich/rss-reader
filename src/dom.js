'use strict';

// import net/url.js
// import third-party/parseSrcset.js

// Returns the first matching css rule within the given sheet, or undefined if
// no rules match.
//
// @param sheet css style sheet
// @param selector_text {String}
// @returns rule {???}
function dom_find_css_rule(sheet, selector_text) {
  console.assert(sheet);

  for(const rule of sheet.cssRules) {
    if(rule.selectorText === selector_text) {
      return rule;
    }
  }
}

// Use the first sheet
function dom_get_default_stylesheet() {
  const sheets = document.styleSheets;
  if(sheets.length) {
    return sheets[0];
  }
}


// Returns true if the given name is a valid name for an element. This only
// does minimal validation.
function dom_is_valid_element_name(name) {
  return typeof name === 'string' && name.length && !name.includes(' ');
}

// Replace an element with its children. Special care is taken to add spaces
// if the operation would result in adjacent text nodes.
function dom_unwrap(element) {
  console.assert(element instanceof Element);
  // Calling unwrap on an orphan is always an error
  console.assert(element.parentNode, 'orphaned element');

  const parent_element = element.parentNode;
  const prev_sibling = element.previousSibling;
  const next_sibling = element.nextSibling;
  const first_child = element.firstChild;
  const last_child = element.lastChild;
  const TEXT = Node.TEXT_NODE;
  const frag = element.ownerDocument.createDocumentFragment();

  // Detach upfront for O(2) live dom ops, compared to O(n-children) otherwise
  element.remove();

  // Add leading padding
  if(prev_sibling && prev_sibling.nodeType === TEXT &&
    first_child && first_child.nodeType === TEXT) {
    frag.appendChild(element.ownerDocument.createTextNode(' '));
  }

  // Move children to fragment, maintaining order
  for(let node = first_child; node; node = element.firstChild) {
    frag.appendChild(node);
  }

  // Add trailing padding
  if(last_child && first_child !== last_child && next_sibling &&
    next_sibling.nodeType === TEXT && last_child.nodeType === TEXT) {
    frag.appendChild(element.ownerDocument.createTextNode(' '));
  }

  // If next_sibling is undefined then insertBefore appends
  parent_element.insertBefore(frag, next_sibling);
  return RDR_OK;
}


// Changes the tag name of an element. Event listeners are lost on rename. No
// checking is done regarding whether the result is semantically correct.
//
// See https://stackoverflow.com/questions/15408394 for a basic explanation of
// why event listeners are lost on rename.
//
// @param copy_attrs {Boolean} optional, if true then attributes are maintained,
// defaults to true.
// @returns {Element} the new element that replaced the old one
function dom_rename(element, new_element_name, copy_attrs) {

  // According to MDN docs, createElement(null) works like createElement("null")
  // so, to avoid that, treat missing name as an error
  console.assert(dom_is_valid_element_name(new_element_name));

  if(typeof copy_attrs === 'undefined') {
    copy_attrs = true;
  }

  // Treat attempting to rename an element to the same name as a noop
  if(element.localName === new_element_name.toLowerCase()) {
    return element;
  }

  const parent_element = element.parentNode;

  // Fail silently on orphaned elements. Caller not required to guarantee
  // parent.
  if(!parent_element) {
    return element;
  }

  // Use next sibling to record position prior to detach. May be undefined.
  const next_sibling = element.nextSibling;

  // Detach the existing node, prior to performing other dom operations, so that
  // the other operations take place on a detached node, so that the least
  // amount of live dom operations are made. Implicitly, this sets
  // parentNode and nextSibling to undefined.
  element.remove();

  const new_element = element.ownerDocument.createElement(new_element_name);

  if(copy_attrs) {
    dom_copy_attributes(element, new_element);
  }

  // Move children
  let child_node = element.firstChild;
  while(child_node) {
    new_element.appendChild(child_node);
    child_node = element.firstChild;
  }

  // Attach the new element in place of the old element
  // If next_sibling is undefined then insertBefore simply appends
  // Returns the new element
  return parent_element.insertBefore(new_element, next_sibling);
}

// Copies the attributes of an element to another element. Overwrites any
// existing attributes in the other element.
// @param from_element {Element}
// @param to_element {Element}
// @throws {Error} if either element is not an Element
// @returns void
function dom_copy_attributes(from_element, to_element) {
  // Use getAttributeNames in preference to element.attributes due to
  // performance issues with element.attributes, and to allow unencumbered use
  // of the for..of syntax (I had issues with NamedNodeMap and for..of).
  const names = from_element.getAttributeNames();
  for(const name of names) {
    const value = from_element.getAttribute(name);
    to_element.setAttribute(name, value);
  }
}

// Only looks at inline style.
// Returns {'width': int, 'height': int} or undefined
function dom_get_dimensions(element) {

  // Accessing element.style is a performance heavy operation sometimes, so
  // try and avoid calling it.
  if(!element.hasAttribute('style')) {
    return;
  }

  // TODO: support all value formats
  const dims = {};
  const radix = 10;
  dims.width = parseInt(element.style.width, radix);
  dims.height = parseInt(element.style.height, radix);

  if(isNaN(dims.width) || isNaN(dims.height)) {
    return;
  } else {
    return dims;
  }
}

// TODO: this could use some cleanup or at least some clarifying comments
function dom_fade(element, duration_secs, delay_secs) {
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


// Return true if the first parameter is an image element
// TODO: inline, not a sufficient abstraction
function dom_is_image(image) {
  // TODO: be more precise, use HTMLImageElement or whatever it is
  return image instanceof Element;
}

// TODO: also has source if within picture and picture has <source>, or
// alternatively rename to image_has_source_attribute
function dom_image_has_source(image) {
  console.assert(dom_is_image(image));
  return image.hasAttribute('src') || dom_image_has_srcset(image);
}

// Return true if image has a valid src attribute value
function dom_image_has_valid_source(image) {
  console.assert(dom_is_image(image));
  return url_is_valid(image.getAttribute('src'));
}

// Return true if image has a non-empty srcset attribute value
function dom_image_has_srcset(image) {
  console.assert(dom_is_image(image));
  const srcset_value = image.getAttribute('srcset');
  return srcset_value && srcset_value.trim();
}

// Searches for and returns the corresponding figcaption element
function dom_find_caption(image) {
  console.assert(dom_is_image(image));
  let figcaption;
  const figure = image.closest('figure');
  if(figure) {
    figcaption = figure.querySelector('figcaption');
  }
  return figcaption;
}

// TODO: remove picture/source/figure/figcaption
function dom_remove_image(image) {
  image.remove();
}


// Find the lowest common ancestor of two nodes. Assumes
// node1 does not contain node2, and node2 does not contain node1.
//
// Adapted from https://stackoverflow.com/questions/3960843
// Returns an object with properties ancestor, d1, and d2. ancestor is the
// lowest common ancestor. d1 is the distance from node1 to the ancestor, in
// terms of edge traversals. d2 is the distance from node2 to the ancestor.
//
// TODO: change to varargs, find the LCAs of whatever args given, instead of
// only 2. change to (...nodes)
function dom_find_lca(node1, node2) {
  console.assert(node1 instanceof Node);
  console.assert(node2 instanceof Node);
  console.assert(node1 !== node2);
  console.assert(node1.ownerDocument === node2.ownerDocument);

  const ancestors1 = dom_ancestors(node1);
  const ancestors2 = dom_ancestors(node2);

  // The +1s are for the immediate parent steps
  const len1 = ancestors1.length, len2 = ancestors2.length;
  for(let i = 0; i < len1; i++) {
    const ancestor1 = ancestors1[i];
    for(let j = 0; j < len2; j++) {
      if(ancestor1 === ancestors2[j]) {
        return {
          'ancestor': ancestor1,
          'd1': i + 1,
          'd2': j + 1
        };
      }
    }
  }

  console.assert(false);
}

// Returns an array of ancestors, from deepest to shallowest.
// The node itself is not included.
function dom_ancestors(node) {
  console.assert(node instanceof Node);
  const ancestors = [];
  for(let an = node.parentNode; an; an = an.parentNode) {
    ancestors.push(an);
  }
  return ancestors;
}


// @param descriptors {Array} an array of descriptors such as those produced
// by parseSrcset (third party library)
// @returns {String} a string suitable for storing as srcset attribute value
function dom_srcset_serialize(descriptors) {
  console.assert(Array.isArray(descriptors));

  const descriptor_strings = [];
  for(const descriptor of descriptors) {
    const strings = [descriptor.url];
    if(descriptor.d) {
      strings.push(' ');
      strings.push(descriptor.d);
      strings.push('x');
    } else if(descriptor.w) {
      strings.push(' ');
      strings.push(descriptor.w);
      strings.push('w');
    } else if(descriptor.h) {
      strings.push(' ');
      strings.push(descriptor.h);
      strings.push('h');
    }

    const descriptor_string = strings.join('');
    descriptor_strings.push(descriptor_string);
  }

  return descriptor_strings.join(', ');
}

// Returns an array of descriptor objects. If the input is bad, or an error
// occurs, returns an empty array.
// @param srcset {String}
function dom_srcset_parse_from_string(srcset) {
  const fallback_output = [];

  if(typeof srcset !== 'string') {
    return fallback_output;
  }

  let descriptors;
  try {
    descriptors = parseSrcset(srcset);
  } catch(error) {
    return fallback_output;
  }

  if(!Array.isArray(descriptors)) {
    return fallback_output;
  }

  return descriptors;
}


// Returns true if an element, or any of its ancestors, is hidden.
// @param element {Element}
function dom_element_is_hidden(element) {
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
  if(dom_element_is_hidden_inline(element)) {
    return true;
  }

  // TODO: the collection of ancestors should be delegated to dom_ancestors
  // in node.js. This probably also entails changing the order of iteration
  // over the ancestors in the subsequent loop.

  // Walk bottom-up from after element to before body, recording the path
  const path = [];
  for(let e = element.parentNode; e && e !== body; e = e.parentNode) {
    path.push(e);
  }

  // Step backward along the path and stop upon finding the first hidden node
  // This is top down.
  for(let i = path.length - 1; i > -1; i--) {
    if(dom_element_is_hidden_inline(path[i])) {
      return true;
    }
  }

  return false;
}

// Returns true if an element is hidden according to its inline style. Makes
// mostly conservative guesses and misses a few cases.
function dom_element_is_hidden_inline(element) {
  console.assert(element instanceof Element);

  // BUG: seeing cannot read length of undefined in console. My understanding
  // is that all elements have a style property. So perhaps this is not
  // getting called on an element? But the previous assert never fails, element
  // is an instanceof an element. Or does it? Check again.
  // NOTE: this bug only arose after recent changes to poll_entry and after
  // adding brackets to all single line if/for blocks

  const style = element.style;

  // TEMP: for some reason this assertion occasionally fails
  console.assert(style);

  // TEMP: researching bug
  if(!style) {
    console.warn('styleless element', element.innerHTML.substring(0, 50));
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
    dom_is_near_transparent(element) ||
    dom_is_offscreen(element);
}

// Returns true if the element's opacity is too close to 0
// TODO: support all formats of the opacity property?
function dom_is_near_transparent(element) {
  const opacity = parseFloat(element.style.opacity);
  return !isNaN(opacity) && opacity >= 0 && opacity <= 0.3;
}

// Returns true if the element is positioned off screen.
// Heuristic guess. Probably several false negatives, and a few false
// positives. The cost of guessing wrong is not too high.
// This is pretty inaccurate. Mostly just a mental note.
// Again, restricted to inert document context.
function dom_is_offscreen(element) {
  if(element.style.position === 'absolute') {
    const radix = 10;
    const left = parseInt(element.style.left, radix);
    if(!isNaN(left) && left < 0) {
      return true;
    }
  }

  return false;
}
