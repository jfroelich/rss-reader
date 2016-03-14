// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

// Requires: /src/calamine.js
// Requires: /src/utils.js
// Exports: pruneDocument
// Lib for filtering the contents of an HTML Document object

// TODO: merge table processing functions

(function(exports) {
'use strict';

const BLACKLIST_SELECTOR = [
  'applet',
  'audio',
  'basefont',
  'bgsound',
  'button',
  'command',
  'datalist',
  'dialog',
  'embed',
  'fieldset',
  'frame',
  'frameset',
  'head',
  'iframe',
  'input',
  'isindex',
  'link',
  'math',
  'meta',
  'noembded',
  'noscript',
  'object',
  'output',
  'optgroup',
  'option',
  'param',
  'path',
  'progress',
  'script',
  'select',
  'spacer',
  'style',
  'svg',
  'textarea',
  'title',
  'video',
  'xmp'
].join(',');

//TODO: include aria hidden?
// https://www.w3.org/TR/wai-aria/states_and_properties#aria-hidden
const HIDDEN_SELECTOR = [
  '[style*="display:none"]',
  '[style*="display: none"]',
  '[style*="visibility:hidden"]',
  '[style*="visibility: hidden"]',
  '[style*="opacity:0.0"]'
].join(',');

function pruneDocument(document) {
  filterComments(document);
  replaceFrames(document);
  utils.forEach(document.querySelectorAll(BLACKLIST_SELECTOR),
    removeIfAttached);
  utils.forEach(document.querySelectorAll(HIDDEN_SELECTOR), removeIfAttached);
  filterBoilerplate(document);
  utils.forEach(document.querySelectorAll('a'), filterAnchor);
  // utils.forEach(document.querySelectorAll('br'), filterBreakRule);
  utils.forEach(utils.filter(document.querySelectorAll('img'),
    isFilterableImage), utils.removeNode);
  filterInlines(document);
  filterTexts(document);
  filterLists(document);
  unwrapSingleCellTables(document);
  filterSingleColumnTables(document);
  filterLeaves(document);
  trimDocument(document);
  filterAttributes(document);
}

function filterBoilerplate(document) {
  applyCalamine(document, false);
}

function filterComments(document) {
  const it = document.createNodeIterator(document.documentElement,
    NodeFilter.SHOW_COMMENT);
  for(let node = it.nextNode(); node; node = it.nextNode()) {
    node.remove();
  }
}

function removeIfAttached(element) {
  if(element.ownerDocument.documentElement.contains(element)) {
    element.remove();
  }
}

// TODO: research why content sometimes appears garbled, like encoded, as if
// it is re-encoding html
function replaceFrames(document) {
  let body = document.body;
  if(!body || body.localName !== 'frameset') {
    return;
  }

  const noframes = document.querySelector('noframes');
  if(noframes) {
    body.innerHTML = noframes.innerHTML;
  } else {
    body.textContent = 'Unable to display framed document.';
  }
}

function filterBreakRule(element) {
  // TODO: improve
  // error case: http://paulgraham.com/procrastination.html
  // This is buggy, temporarily a NO-OP.

  const parent = element.parentNode;
  const p = document.createElement('p');
  parent.replaceChild(p, element);
}

function filterAttributes(document) {
  const elements = document.getElementsByTagName('*');
  const numElements = elements.length;

  // Iterate attributes in reverse to avoid issues with mutating a live
  // NodeList during iteration

  let elementName = null;
  let attributeName = null;
  let element = null;
  let attributes = null;
  let j = 0;

  for(let i = 0; i < numElements; i++) {
    element = elements[i];
    elementName = element.localName;
    attributes = element.attributes;
    if(!attributes || !attributes.length) {
      continue;
    }

    if(elementName === 'source') {
      // new <picture><source></picture> stuff
      for(j = attributes.length - 1; j > -1; j--) {
        attributeName = attributes[j].name;
        if(attributeName !== 'type' && attributeName !== 'srcset' &&
          attributeName !== 'sizes' && attributeName !== 'media' &&
          attributeName !== 'src') {
          element.removeAttribute(attributeName);
        }
      }
    } else if(elementName === 'a') {
      for(j = attributes.length - 1; j > -1; j--) {
        attributeName = attributes[j].name;
        if(attributeName !== 'href' && attributeName !== 'name' &&
          attributeName !== 'title') {
          element.removeAttribute(attributeName);
        }
      }
    } else if(elementName === 'iframe') {
      for(j = attributes.length - 1; j > -1; j--) {
        attributeName = attributes[j].name;
        if(attributeName !== 'src') {
          element.removeAttribute(attributeName);
        }
      }
    } else if(elementName === 'img') {
      for(j = attributes.length - 1; j > -1; j--) {
        attributeName = attributes[j].name;
        if(attributeName !== 'src' && attributeName !== 'alt' &&
          attributeName !== 'srcset' && attributeName !== 'title') {
          element.removeAttribute(attributeName);
        }
      }
    } else {
      for(j = attributes.length - 1; j > -1; j--) {
        element.removeAttribute(attributes[j].name);
      }
    }
  }
}

const INLINE_ELEMENT_SELECTOR = [
  'article',
  'center',
  'colgroup',
  'data',
  'details',
  'div',
  'footer',
  'header',
  'help',
  'hgroup',
  'ilayer',
  'insert',
  'layer',
  'legend',
  'main',
  'mark',
  'marquee',
  'meter',
  'multicol',
  'nobr',
  'noembed',
  'section',
  'span',
  'tbody',
  'tfoot',
  'thead',
  'form',
  'label',
  'big',
  'blink',
  'font',
  'plaintext',
  'small',
  'tt'
].join(',');

function filterInlines(document) {
  utils.forEach(document.querySelectorAll(INLINE_ELEMENT_SELECTOR),
    filterInlineElement);
}

// TODO: this is still slow. profile against the more naive version
// that unwrapped all elements immediately
function filterInlineElement(element) {
  // TODO: describe why this is done, it is non-obvious
  const firstChild = element.firstChild;
  if(firstChild && firstChild === element.lastChild &&
    isElementNode(firstChild) &&
    firstChild.matches(INLINE_ELEMENT_SELECTOR)) {
    // Skip
  } else {
    // Find shallowest consecutive inline ancestor
    let farthest = null;
    for(let ancestor = element.parentNode; ancestor &&
      ancestor.childElementCount === 1 &&
      ancestor.matches(INLINE_ELEMENT_SELECTOR);
      ancestor = ancestor.parentNode) {
      farthest = ancestor;
    }
    unwrap(element, farthest);
  }
}

function filterLeaves(document) {
  utils.forEach(document.querySelectorAll('*'), removeIfAttachedLeaf);
}

function removeIfAttachedLeaf(element) {
  const documentElement = element.ownerDocument.documentElement;

  // TODO: rather than return, maybe just suppress the isAttached check and
  // still do the isLeaf->remove sequence? What is the more intuitive or
  // expected behavior?
  if(!documentElement) {
    console.debug('No document element:', element.outerHTML);
    return;
  }

  if(documentElement.contains(element) && isLeaf(element)) {
    element.remove();
  }
}

const LEAF_EXCEPTIONS = {
  'area': 1,
  'audio': 1,
  'base': 1,
  'col': 1,
  'command': 1,
  'br': 1,
  'canvas': 1,
  'col': 1,
  'hr': 1,
  'iframe': 1,
  'img': 1,
  'input': 1,
  'keygen': 1,
  'meta': 1,
  'nobr': 1,
  'param': 1,
  'path': 1,
  'source': 1,
  'svg': 1,
  'textarea': 1,
  'track': 1,
  'video': 1,
  'wbr': 1
};

function isLeafException(element) {
  return element.localName in LEAF_EXCEPTIONS;
}

function isLeaf(element) {
  return !isLeafException(element) &&
    !utils.some(element.childNodes, isNonLeafChild);
}

// An element is a non-leaf child it is a text node with a non-whitespace
// value or if it is a non-leaf element
function isNonLeafChild(node) {
  if(isTextNode(node)) {
    if(node.nodeValue.trim()) {
      return true;
    }
  } else if(isElementNode(node)) {
    if(!isLeaf(node)) {
      return true;
    }
  } else {
    // Treat other node types as non-leaf
    return true;
  }

  return false;
}

function isTextNode(node) {
  return node.nodeType === Node.TEXT_NODE;
}

function isElementNode(node) {
  return node.nodeType === Node.ELEMENT_NODE;
}

function filterAnchor(anchor) {
  if(isNominalAnchor(anchor)) {
    unwrap(anchor);
  } else if(isJavascriptAnchor(anchor)) {
    // TODO: unwrap/remove?
    anchor.setAttribute('href', '');
  }
}

function isNominalAnchor(anchor) {
  return !anchor.hasAttribute('name') && !anchor.hasAttribute('href');
}

function isJavascriptAnchor(anchor) {
  return /\s*javascript\s*:/i.test(anchor.getAttribute('href'));
}

function unwrapSingleCellTables(document) {
  utils.forEach(document.querySelectorAll('table'), unwrapTableIfSingleCell);
}

// TODO: what about skipping past empty rows and still unwrapping?
function unwrapTableIfSingleCell(table) {
  const rows = table.rows;
  if(rows.length === 1) {
    const cells = rows[0].cells;
    if(cells.length === 1) {
      const cell = cells[0];
      const parent = table.parentNode;
      parent.insertBefore(document.createTextNode(' '), table);
      insertChildrenBefore(cell, table);
      parent.insertBefore(document.createTextNode(' '), table);
      table.remove();
    }
  }
}

function filterSingleColumnTables(document) {
  utils.forEach(document.querySelectorAll('table'), filterTableIfSingleColumn);
}

function filterTableIfSingleColumn(table) {
  if(isProbablySingleColumnTable(table)) {
    const parent = table.parentNode;
    const document = table.ownerDocument;
    for(let rows = table.rows, numRows = rows.length, rowIndex = 0,
      columnIndex = 0, cell, cells, numCells = 0;
      rowIndex < numRows; rowIndex++) {
      for(columnIndex = 0, cells = rows[rowIndex], numCells = cells.length;
        columnIndex < numCells; columnIndex++) {
        cell = cells[columnIndex];
        insertChildrenBefore(cell, table);
      }

      parent.insertBefore(document.createElement('p'), table);
    }

    table.remove();
  }
}

function isProbablySingleColumnTable(table) {
  const rows = table.rows;
  for(let i = 0, upper = Math.min(rows.length, 50); i < upper; i++) {
    if(rows[i].cells.length > 1) {
      return false;
    }
  }
  return true;
}

function filterLists(document) {
  utils.forEach(document.querySelectorAll('ul, ol'), unwrapSingleItemList);
}

function unwrapSingleItemList(list) {
  if(list.childElementCount === 1) {
    const item = list.firstElementChild;
    if(item.localName === 'li') {
      insertChildrenBefore(item, list);
      list.remove();
    }
  }
}

function isFilterableImage(image) {
  return isSourcelessImage(image) || isTracerImage(image);
}

function isSourcelessImage(image) {
  return !image.hasAttribute('src') && !image.hasAttribute('srcset');
}

function isTracerImage(image) {
  return image.width < 2 || image.height < 2;
}

function trimDocument(document) {
  const body = document.body;
  if(body) {
    let sibling = body;
    let node = body.firstChild;
    while(node && isWhitespaceNode(node)) {
      sibling = node.nextSibling;
      node.remove();
      node = sibling;
    }

    node = body.lastChild;
    while(node && isWhitespaceNode(node)) {
      sibling = node.previousSibling;
      node.remove();
      node = sibling;
    }
  }
}

function isWhitespaceNode(node) {
  const TRIMMABLE_ELEMENTS = {
    'br': 1,
    'hr': 1,
    'nobr': 1
  };

  return (isElementNode(node) && node.localName in TRIMMABLE_ELEMENTS) ||
    (isTextNode(node) && !node.nodeValue.trim());
}

function isTrivialNodeValue(value) {
  // todo: would a length check or switch improve/simplify?
  return value === '' || value === '\n' || value === '\n\t' ||
    value === '\n\t\t' || value === '\n\t\t\t' || value === '\n\t\t\t\t';
}

function isWhitespaceSensitive(element) {
  return element.closest('code, pre, ruby, textarea, xmp');
}

function filterTexts(document) {
  const it = document.createNodeIterator(document.documentElement,
    NodeFilter.SHOW_TEXT);
  for(let node = it.nextNode(), value; node; node = it.nextNode()) {
    value = node.nodeValue;
    if(!isTrivialNodeValue(value)) {
      value = canonicalizeWhitespace(value);
    }
    if(!isWhitespaceSensitive(node.parentNode)) {
      value = condenseSpaces(value);
    }
    node.nodeValue = value;
  }
}

function canonicalizeWhitespace(nodeValue) {
  return nodeValue.replace(/&nbsp;/ig, ' ');
}

function condenseSpaces(nodeValue) {
  return nodeValue.replace(/\s{2,}/g, ' ');
}

// Unwraps the element's child nodes into the parent of the element or, if
// provided, the parent of the alternate element
function unwrap(element, referenceNode) {
  const target = referenceNode || element;
  const parent = target.parentNode;
  const document = element.ownerDocument;
  const prevSibling = target.previousSibling;
  const nextSibling = target.nextSibling;
  if(parent) {
    if(prevSibling && isTextNode(prevSibling))
      parent.insertBefore(document.createTextNode(' '), target);
    insertChildrenBefore(element, target);
    if(nextSibling && isTextNode(nextSibling))
      parent.insertBefore(document.createTextNode(' '), target);
  }
  target.remove();
}

function insertChildrenBefore(parentNode, referenceNode) {
  const referenceParent = referenceNode.parentNode;
  for(let node = parentNode.firstChild; node; node = parentNode.firstChild) {
    referenceParent.insertBefore(node, referenceNode);
  }
}

// Exports
exports.pruneDocument = pruneDocument;

}(this));
