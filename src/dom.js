'use strict';

// import third-party/parseSrcset.js
// import rbl.js
// import url.js

// Returns the first matching css rule within the given sheet, or undefined if
// no rules match.
//
// @param sheet css style sheet
// @param selectorText {String}
// @returns rule {???}
function domFindCSSRule(sheet, selectorText) {
  assert(sheet);

  for(const rule of sheet.cssRules) {
    if(rule.selectorText === selectorText) {
      return rule;
    }
  }
}

// Use the first sheet
function domGetDefaultStylesheet() {
  const sheets = document.styleSheets;
  if(sheets.length) {
    return sheets[0];
  }
}

// Returns true if the given name is a valid name for an element. This only
// does minimal validation and may yield false positives.
function domIsValidElementName(name) {
  return typeof name === 'string' && name.length && !name.includes(' ');
}

// Replace an element with its children. Special care is taken to add spaces
// if the operation would result in adjacent text nodes.
function domUnwrap(element) {
  assert(element instanceof Element);
  assert(element.parentNode, 'orphaned element');

  const parentElement = element.parentNode;
  const previousSibling = element.previousSibling;
  const nextSibling = element.nextSibling;
  const firstChild = element.firstChild;
  const lastChild = element.lastChild;
  const TEXT = Node.TEXT_NODE;
  const frag = element.ownerDocument.createDocumentFragment();

  // Detach upfront for O(2) live dom ops, compared to O(n-children) otherwise
  element.remove();

  // Add leading padding
  if(previousSibling && previousSibling.nodeType === TEXT && firstChild &&
    firstChild.nodeType === TEXT) {
    frag.appendChild(element.ownerDocument.createTextNode(' '));
  }

  // Move children to fragment, maintaining order
  for(let node = firstChild; node; node = element.firstChild) {
    frag.appendChild(node);
  }

  // Add trailing padding
  if(lastChild && firstChild !== lastChild && nextSibling && nextSibling.nodeType === TEXT &&
    lastChild.nodeType === TEXT) {
    frag.appendChild(element.ownerDocument.createTextNode(' '));
  }

  // If nextSibling is undefined then insertBefore appends
  parentElement.insertBefore(frag, nextSibling);
}

// Changes the tag name of an element. Event listeners are lost on rename. No
// checking is done regarding whether the result is semantically correct.
//
// See https://stackoverflow.com/questions/15408394 for a basic explanation of
// why event listeners are lost on rename.
//
// @param copyAttributes {Boolean} optional, if true then attributes are
// maintained, defaults to true.
// @returns {Element} the new element that replaced the old one
function domRename(element, newName, copyAttributes) {

  // Disallow createElement(null) working like createElement("null")
  assert(domIsValidElementName(newName));

  if(typeof copyAttributes === 'undefined') {
    copyAttributes = true;
  }

  // Treat attempting to rename an element to the same name as a noop
  if(element.localName === newName.toLowerCase()) {
    return element;
  }

  const parentElement = element.parentNode;

  // Fail silently on orphaned elements. Caller not required to guarantee
  // parent.
  if(!parentElement) {
    return element;
  }

  // Use next sibling to record position prior to detach. May be undefined.
  const nextSibling = element.nextSibling;

  // Detach the existing node, prior to performing other dom operations, so that
  // the other operations take place on a detached node, so that the least
  // amount of live dom operations are made. Implicitly, this sets
  // parentNode and nextSibling to undefined.
  element.remove();

  const newElement = element.ownerDocument.createElement(newName);

  if(copyAttributes) {
    domCopyAttributes(element, newElement);
  }

  // Move children
  let childNode = element.firstChild;
  while(childNode) {
    newElement.appendChild(childNode);
    childNode = element.firstChild;
  }

  // Attach the new element in place of the old element
  // If nextSibling is undefined then insertBefore simply appends
  // Returns the new element
  return parentElement.insertBefore(newElement, nextSibling);
}

// Copies the attributes of an element to another element. Overwrites any
// existing attributes in the other element.
// @param fromElement {Element}
// @param toElement {Element}
// @throws {Error} if either element is not an Element
// @returns void
function domCopyAttributes(fromElement, toElement) {
  // Use getAttributeNames in preference to element.attributes due to
  // performance issues with element.attributes, and to allow unencumbered use
  // of the for..of syntax (I had issues with NamedNodeMap and for..of).
  const names = fromElement.getAttributeNames();
  for(const name of names) {
    const value = fromElement.getAttribute(name);
    toElement.setAttribute(name, value);
  }
}

// Only looks at inline style.
// Returns {'width': int, 'height': int} or undefined
function domGetDimensions(element) {

  // Accessing element.style is a performance heavy operation sometimes, so
  // try and avoid calling it.
  if(!element.hasAttribute('style')) {
    return;
  }

  // Some elements do not have a defined style property.
  if(!element.style) {
    return;
  }

  // TODO: support all value formats
  const dims = {};
  dims.width = parseInt10(element.style.width);
  dims.height = parseInt10(element.style.height);

  if(isNaN(dims.width) || isNaN(dims.height)) {
    return;
  } else {
    return dims;
  }
}

// TODO: this could use some cleanup or at least some clarifying comments
function domFade(element, durationSecs, delaySecs) {
  return new Promise(function executor(resolve, reject) {
    const style = element.style;
    if(style.display === 'none') {
      style.opacity = '0';
      style.display = 'block';
    } else {
      style.opacity = '1';
    }

    element.addEventListener('webkitTransitionEnd', resolve, {'once': true});

    // property duration function delay
    style.transition = `opacity ${durationSecs}s ease ${delaySecs}s`;
    style.opacity = style.opacity === '1' ? '0' : '1';
  });
}

// TODO: also has source if within picture and picture has <source>, or
// alternatively rename to domImageHasSourceAttribute
function domImageHasSource(image) {
  assert(image instanceof Element);
  return image.hasAttribute('src') || domImageHasSrcset(image);
}

// Return true if image has a valid src attribute value
function domImageHasValidSource(image) {
  assert(image instanceof Element);
  return isValidURL(image.getAttribute('src'));
}

// Return true if image has a non-empty srcset attribute value
function domImageHasSrcset(image) {
  assert(image instanceof Element);
  const imageSrcset = image.getAttribute('srcset');
  return imageSrcset && imageSrcset.trim();
}

// Searches for and returns the corresponding figcaption element
function domFindCaption(image) {
  assert(image instanceof Element);
  let figcaption;
  const figure = image.closest('figure');
  if(figure) {
    figcaption = figure.querySelector('figcaption');
  }
  return figcaption;
}

// TODO: remove picture/source/figure/figcaption
function domRemoveImage(image) {
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
function domFindLCA(node1, node2) {
  assert(node1 instanceof Node);
  assert(node2 instanceof Node);
  assert(node1 !== node2);
  assert(node1.ownerDocument === node2.ownerDocument);

  const ancestors1 = domAncestors(node1);
  const ancestors2 = domAncestors(node2);

  // The +1s are for the immediate parent steps
  const len1 = ancestors1.length, len2 = ancestors2.length;
  for(let i = 0; i < len1; i++) {
    const ancestor1 = ancestors1[i];
    for(let j = 0; j < len2; j++) {
      if(ancestor1 === ancestors2[j]) {
        return {ancestor: ancestor1, d1: i + 1, d2: j + 1};
      }
    }
  }

  assert(false);
}

// Returns an array of ancestors, from deepest to shallowest.
// The node itself is not included.
function domAncestors(node) {
  assert(node instanceof Node);
  const ancestors = [];
  for(let parent = node.parentNode; parent; parent = parent.parentNode) {
    ancestors.push(parent);
  }
  return ancestors;
}

// @param descriptors {Array} an array of descriptors such as those produced
// by parseSrcset (third party library)
// @returns {String} a string suitable for storing as srcset attribute value
function domSrcsetSerialize(descriptors) {
  assert(Array.isArray(descriptors));

  const descriptorStrings = [];
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

    const descriptorString = strings.join('');
    descriptorStrings.push(descriptorString);
  }

  return descriptorStrings.join(', ');
}

// Returns an array of descriptor objects. If the input is bad, or an error
// occurs, returns an empty array.
// @param srcset {String}
function domSrcsetParseFromString(srcset) {
  const fallbackOutput = [];

  if(typeof srcset !== 'string') {
    return fallbackOutput;
  }

  let descriptors;
  try {
    descriptors = parseSrcset(srcset);
  } catch(error) {
    return fallbackOutput;
  }

  if(!Array.isArray(descriptors)) {
    return fallbackOutput;
  }

  return descriptors;
}

// Returns true if an element, or any of its ancestors, is hidden.
// @param element {Element}
function domIsHidden(element) {
  assert(element instanceof Element);

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
  // TODO: this should just be an if?
  assert(body.contains(element));

  // Quickly test the element itself before testing ancestors, with the hope
  // of avoiding checking ancestors
  if(domIsHiddenInline(element)) {
    return true;
  }

  // TODO: the collection of ancestors should be delegated to domAncestors
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
    if(domIsHiddenInline(path[i])) {
      return true;
    }
  }

  return false;
}

// Returns true if an element is hidden according to its inline style. Makes
// mostly conservative guesses and misses a few cases.
function domIsHiddenInline(element) {
  assert(element instanceof Element);

  // Special handling for MathML. <math> and its subelements do not contain
  // a style property in a parsed DOM (apparently). I don't know if this is
  // a bug or expected behavior. In any case, consider math elements and
  // descendants of math elements as always visible.
  // NOTE: closest includes the element itself
  if(element.closest('math')) {
    return false;
  }

  const style = element.style;

  // Some elements do not have a style prop.
  if(!style) {
    console.debug('no style prop:', element.outerHTML.substring(0, 100));
    return false;
  }

  // element.style only has a length if one or more explicit properties are set
  // elements are visible by default, so if no properties set then the element
  // cannot be hidden. Testing this helps avoid the more expensive tests
  // later in this function.
  if(!style.length) {
    return false;
  }

  return style.display === 'none' || style.visibility === 'hidden' ||
    domIsNearTransparent(element) || domIsOffscreen(element);
}

// Returns true if the element's opacity is too close to 0
// TODO: support all formats of the opacity property?
function domIsNearTransparent(element) {
  const opacity = parseFloat(element.style.opacity);
  return !isNaN(opacity) && opacity >= 0 && opacity <= 0.3;
}

// Returns true if the element is positioned off screen.
// Heuristic guess. Probably several false negatives, and a few false
// positives. The cost of guessing wrong is not too high.
// This is pretty inaccurate. Mostly just a mental note.
// Again, restricted to inert document context.
function domIsOffscreen(element) {
  if(element.style.position === 'absolute') {
    const left = parseInt10(element.style.left);
    if(!isNaN(left) && left < 0) {
      return true;
    }
  }

  return false;
}
