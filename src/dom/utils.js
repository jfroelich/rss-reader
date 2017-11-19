// DOM utilities

import assert from "/src/utils/assert.js";
import {parseInt10} from "/src/utils/string.js";


// Returns the first matching css rule within the given sheet, or undefined if no rules match.
//
// @param sheet css style sheet
// @param selectorText {String}
// @returns rule {???}
export function findCSSRule(sheet, selectorText) {
  assert(sheet);

  for(const rule of sheet.cssRules) {
    if(rule.selectorText === selectorText) {
      return rule;
    }
  }
}

// Use the first sheet
export function getDefaultStylesheet() {
  const sheets = document.styleSheets;
  if(sheets.length) {
    return sheets[0];
  }
}

// Returns true if the given name is a valid name for an element. This only does minimal validation
// and may yield false positives.
function isValidElementName(name) {
  return typeof name === 'string' && name.length && !name.includes(' ');
}

// Replace an element with its children. Special care is taken to add spaces if the operation would
// result in adjacent text nodes.
export function unwrap(element) {
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

export function unwrapElements(ancestorElement, selector) {
  assert(ancestorElement instanceof Element);
  assert(typeof selector === 'string');
  const elements = ancestorElement.querySelectorAll(selector);
  for(const element of elements) {
    unwrap(element);
  }
}

// Changes the tag name of an element. Event listeners are lost on rename. No checking is done
// regarding whether the result is semantically correct.
//
// See https://stackoverflow.com/questions/15408394 for a basic explanation of why event listeners
//are lost on rename.
//
// @param copyAttributesFlag {Boolean} optional, if true then attributes are maintained, defaults to
// true.
// @returns {Element} the new element that replaced the old one
export function renameElement(element, newName, copyAttributesFlag) {

  // Disallow createElement(null) working like createElement("null")
  assert(isValidElementName(newName));

  if(typeof copyAttributesFlag === 'undefined') {
    copyAttributesFlag = true;
  }

  // Treat attempting to rename an element to the same name as a noop
  if(element.localName === newName.toLowerCase()) {
    return element;
  }

  const parentElement = element.parentNode;

  // Fail silently on orphaned elements. Caller not required to guarantee parent.
  if(!parentElement) {
    return element;
  }

  // Use next sibling to record position prior to detach. May be undefined.
  const nextSibling = element.nextSibling;

  // Detach the existing node, prior to performing other dom operations, so that the other
  // operations take place on a detached node, so that the least amount of live dom operations are
  // made. Implicitly, this sets parentNode and nextSibling to undefined.
  element.remove();

  const newElement = element.ownerDocument.createElement(newName);

  if(copyAttributesFlag) {
    copyAttributes(element, newElement);
  }

  // Move children
  let childNode = element.firstChild;
  while(childNode) {
    newElement.appendChild(childNode);
    childNode = element.firstChild;
  }

  // Attach the new element in place of the old element. If nextSibling is undefined then
  // insertBefore simply appends. Return the new element.
  return parentElement.insertBefore(newElement, nextSibling);
}

// Copies the attributes of an element to another element. Overwrites any existing attributes in the
// other element.
// @param fromElement {Element}
// @param toElement {Element}
// @throws {Error} if either element is not an Element
// @returns void
export function copyAttributes(fromElement, toElement) {
  // Use getAttributeNames in preference to element.attributes due to performance issues with
  // element.attributes, and to allow unencumbered use of the for..of syntax (I had issues with
  // NamedNodeMap and for..of).
  const names = fromElement.getAttributeNames();
  for(const name of names) {
    const value = fromElement.getAttribute(name);
    toElement.setAttribute(name, value);
  }
}

export function renameElements(ancestorElement, oldName, newName, copyAttributes) {
  assert(typeof oldName === 'string');
  assert(typeof newName === 'string');

  if(ancestorElement) {
    assert(ancestorElement instanceof Element);
    const elements = ancestorElement.querySelectorAll(oldName);
    for(const element of elements) {
      renameElement(element, newName, copyAttributes);
    }
  }
}

// Only looks at inline style.
// Returns {'width': int, 'height': int} or undefined
export function getDimensions(element) {

  // Accessing element.style is a performance heavy operation sometimes, so try and avoid access.
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
export function fadeElement(element, durationSecs, delaySecs) {
  return new Promise(function executor(resolve, reject) {
    const style = element.style;
    assert(style);
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

// Find the lowest common ancestor of two nodes. Assumes node1 does not contain node2, and node2
// does not contain node1.
//
// Adapted from https://stackoverflow.com/questions/3960843
//
// Returns an object with properties ancestor, d1, and d2. ancestor is the lowest common ancestor.
// d1 is the distance from node1 to the ancestor, in terms of edge traversals. d2 is the distance
// from node2 to the ancestor.
//
// TODO: change to varargs, find the LCAs of whatever args given, instead of only 2. change to
// (...nodes)
export function findLCA(node1, node2) {
  assert(node1 instanceof Node);
  assert(node2 instanceof Node);
  assert(node1 !== node2);
  assert(node1.ownerDocument === node2.ownerDocument);

  const ancestors1 = getAncestors(node1);
  const ancestors2 = getAncestors(node2);

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

// Returns an array of ancestors, from deepest to shallowest. The node itself is excluded.
export function getAncestors(node) {
  assert(node instanceof Node);
  const ancestors = [];
  for(let parent = node.parentNode; parent; parent = parent.parentNode) {
    ancestors.push(parent);
  }
  return ancestors;
}
