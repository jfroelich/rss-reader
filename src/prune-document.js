// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

// Requires: /src/calamine.js
// Exports: pruneDocument
// For filtering the contents of an HTML Document object

// TODO: merge table processing functions

(function(exports, Calamine) {
'use strict';

const BLACKLIST = [
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
  'head',
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
];

const BLACKLIST_SELECTOR = BLACKLIST.join(',');

//TODO: include aria hidden?
// https://www.w3.org/TR/wai-aria/states_and_properties#aria-hidden
const HIDDEN_SELECTOR = [
  '[style*="display:none"]',
  '[style*="display: none"]',
  '[style*="visibility:hidden"]',
  '[style*="visibility: hidden"]',
  '[style*="opacity:0.0"]'
].join(',');

const NODE_TYPE_ELEMENT = Node.ELEMENT_NODE;
const NODE_TYPE_TEXT = Node.TEXT_NODE;
const NODE_TYPE_COMMENT = Node.COMMENT_NODE;

function pruneDocument(document) {
  filterComments(document);
  replaceFrames(document);
  removeElementsBySelector(document, 'frameset, frame, iframe');
  removeElementsBySelector(document, BLACKLIST_SELECTOR);
  removeElementsBySelector(document, HIDDEN_SELECTOR);
  filterBoilerplate(document);
  filterAnchors(document);
  filterBreaks(document);
  filterImages(document);
  filterInlines(document);
  filterTexts(document);
  filterLeaves(document);
  filterLists(document);
  filterSingleCellTables(document);
  filterSingleColumnTables(document);
  trimDocument(document);
  filterAttributes(document);
}

function filterBoilerplate(document) {
  const calamine = new Calamine();
  calamine.analyze(document);
  calamine.prune();
}

function filterComments(document) {
  const it = document.createNodeIterator(document.documentElement,
    NODE_TYPE_COMMENT);
  for(let node = it.nextNode(); node; node = it.nextNode()) {
    node.remove();
  }
}

function removeElementsBySelector(document, selector) {
  const elements = document.querySelectorAll(selector);
  const numElements = elements.length;
  const root = document.documentElement;
  for(let i = 0, element = root; i < numElements; i++) {
    element = elements[i];
    if(root.contains(element)) {
      element.remove();
    }
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

function filterBreaks(document) {
  // TODO: improve
  // error case: http://paulgraham.com/procrastination.html
  // This is buggy, temporarily a NO-OP.
  if(true) {
    return;
  }

  const elements = document.querySelectorAll('br');
  const numElements = elements.length;
  for(let i = 0, element, parent, p; i < numElements; i++) {
    element = elements[i];
    parent = element.parentNode;
    p = document.createElement('p');
    parent.replaceChild(p, element);
  }
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

    if(elementName === 'a') {
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

const INLINE_ELEMENT_NAMES = [
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
];

const INLINE_SELECTOR = INLINE_ELEMENT_NAMES.join(',');

// TODO: this is still slow. profile against the more naive version
// that unwrapped all elements immediately
function filterInlines(document) {
  const elements = document.querySelectorAll(INLINE_SELECTOR);
  const numElements = elements.length;

  for(let i = 0, element, firstChild, farthest, ancestor; i < numElements;
    i++) {
    element = elements[i];

    firstChild = element.firstChild;
    if(firstChild && firstChild === element.lastChild &&
      firstChild.nodeType === NODE_TYPE_ELEMENT &&
      firstChild.matches(INLINE_SELECTOR)) {
      // Skip
    } else {
      // Find shallowest consecutive inline ancestor
      farthest = null;
      for(ancestor = element.parentNode; ancestor &&
        ancestor.childElementCount === 1 &&
        ancestor.matches(INLINE_SELECTOR);
        ancestor = ancestor.parentNode) {
        farthest = ancestor;
      }
      unwrap(element, farthest);
    }
  }
}

// Never considered a leaf element even without child nodes
const LEAF_EXCEPTIONS = {
  'area': 1,
  'audio': 1,
  'br': 1,
  'canvas': 1,
  'col': 1,
  'hr': 1,
  'iframe': 1,
  'img': 1,
  'path': 1,
  'source': 1,
  'svg': 1,
  'track': 1,
  'video': 1
};

function filterLeaves(document) {
  const stack = [document.documentElement];
  const leaves = [];
  let element = null;
  while(stack.length) {
    element = stack.pop();
    if(!element.firstChild && !(element.localName in LEAF_EXCEPTIONS)) {
      leaves.push(element);
    } else {
      element = element.lastElementChild;
      while(element) {
        stack.push(element);
        element = element.previousElementSibling;
      }
    }
  }

  for(let i = 0, length = leaves.length; i < length; i++) {
    leaves[i].remove();
  }
}

// TODO: unwrap/remove js anchors?
function filterAnchors(document) {
  const elements = document.querySelectorAll('a');
  const numElements = elements.length;
  for(let i = 0, anchor; i < elements.length; i++) {
    anchor = elements[i];
    if(!anchor.hasAttribute('name') && !anchor.hasAttribute('href')) {
      unwrap(anchor);
    } else if(anchor.hasAttribute('href') &&
      /\s*javascript\s*:/i.test(anchor.getAttribute('href'))) {
      anchor.setAttribute('href', '');
    }
  }
}

function filterSingleCellTables(document) {
  const tables = document.querySelectorAll('table');
  const numTables = tables.length;
  for(let i = 0, table, rows, cells, parent, cell, node; i < numTables; i++) {
    table = tables[i];
    rows = table.rows;
    if(rows.length === 1) {
      cells = rows[0].cells;
      if(cells.length === 1) {
        cell = cells[0];
        parent = table.parentNode;
        parent.insertBefore(document.createTextNode(' '), table);
        insertChildrenBefore(cell, table);
        parent.insertBefore(document.createTextNode(' '), table);
        table.remove();
      }
    }
  }
}

function filterSingleColumnTables(document) {
  const tables = document.querySelectorAll('table');
  const numTables = tables.length;
  let isSingleColumn = false;
  for(let i = 0, j = 0, table, rows, upperBound; i < numTables; i++) {
    table = tables[i];
    rows = table.rows;
    upperBound = Math.min(rows.length, 20);
    isSingleColumn = true;
    for(j = 0; j < upperBound; j++) {
      if(rows[j].cells.length > 1) {
        isSingleColumn = false;
        break;
      }
    }

    if(isSingleColumn) {
      transformSingleColumnTable(table);
    }
  }
}

function transformSingleColumnTable(table) {
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

function filterLists(document) {
  const lists = document.querySelectorAll('ul, ol');
  const numLists = lists.length;
  for(let i = 0, list, node, item; i < numLists; i++) {
    list = lists[i];
    if(list.childElementCount === 1) {
      item = list.firstElementChild;
      if(item.localName === 'li') {
        insertChildrenBefore(item, list);
        list.remove();
      }
    }
  }
}

function filterImages(document) {
  const images = document.querySelectorAll('img');
  const numImages = images.length;
  for(let i = 0, image; i < numImages; i++) {
    image = images[i];
    if(!image.hasAttribute('src') && !image.hasAttribute('srcset')) {
      image.remove();
    } else if(image.width < 2 || image.height < 2) {
      image.remove();
    }
  }
}

function trimDocument(document) {
  const body = document.body;
  if(body) {
    let sibling = body;
    let node = body.firstChild;
    while(node && isTrimmable(node)) {
      sibling = node.nextSibling;
      node.remove();
      node = sibling;
    }

    node = body.lastChild;
    while(node && isTrimmable(node)) {
      sibling = node.previousSibling;
      node.remove();
      node = sibling;
    }
  }
}

function isTrimmable(node) {
  if(node.nodeType === NODE_TYPE_ELEMENT) {
    const name = node.localName;
    if(name === 'br' || name === 'hr' || name === 'nobr') {
      return true;
    } else if(name === 'p') {
      return !node.firstChild;
    }
  } else if(node.nodeType === NODE_TYPE_TEXT) {
    const value = node.nodeValue;
    return value && value.trim();
  }

  return false;
}

function hasTrivialNodeValue(value) {
  return value === '' || value === '\n' || value === '\n\t' ||
    value === '\n\t\t' || value === '\n\t\t\t' || value === '\n\t\t\t\t';
}

function isWhitespaceSensitive(node) {
  return node.parentNode.closest('code, pre, ruby, textarea, xmp');
}

function filterTexts(document) {
  const it = document.createNodeIterator(document.documentElement,
    NodeFilter.SHOW_TEXT);
  for(let node = it.nextNode(), value; node; node = it.nextNode()) {
    value = node.nodeValue;
    if(!hasTrivialNodeValue(value)) {
      value = value.replace(/&nbsp;/ig, ' ');
    }

    if(!isWhitespaceSensitive(node)) {
      value = value.replace(/\s{2,}/g, ' ');
    }
    node.nodeValue = value;
  }
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
    if(prevSibling && prevSibling.nodeType === NODE_TYPE_TEXT)
      parent.insertBefore(document.createTextNode(' '), target);
    insertChildrenBefore(element, target);
    if(nextSibling && nextSibling.nodeType === NODE_TYPE_TEXT)
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

}(this, Calamine));
