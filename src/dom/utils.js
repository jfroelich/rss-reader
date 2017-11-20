// DOM utilities

import assert from "/src/utils/assert.js";
import {parseInt10} from "/src/utils/string.js";
import unwrap from "/src/unwrap-element.js";

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
