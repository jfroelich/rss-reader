// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

// Requires: /src/calamine.js
// Exports: pruneDocument
// For filtering the contents of an HTML Document object

// TODO: merge table processing functions

(function(exports, Calamine) {

'use strict';

const NODE_TYPE_ELEMENT = Node.ELEMENT_NODE;
const NODE_TYPE_TEXT = Node.TEXT_NODE;

function pruneDocument(document) {
  filterComments(document);
  filterFrames(document);
  applyBlacklist(document);
  filterHidden(document);

  const calamine = new Calamine();
  calamine.analyze(document);
  calamine.prune();

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

function filterComments(document) {
  const it = document.createNodeIterator(document.documentElement,
    NodeFilter.SHOW_COMMENT);
  for(let node = it.nextNode(); node; node = it.nextNode()) {
    node.remove();
  }
}

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
  'progress',
  'script',
  'select',
  'spacer',
  'style',
  'textarea',
  'title',
  'video',
  'xmp'
];

const BLACKLIST_SELECTOR = BLACKLIST.join(',');

function applyBlacklist(document) {
  const elements = document.querySelectorAll(BLACKLIST_SELECTOR);
  const numElements = elements.length;
  const root = document.documentElement;
  for(let i = 0, element = root; i < numElements; i++) {
    element = elements[i];
    if(root.contains(element)) {
      element.remove();
    }
  }
}

function filterFrames(document) {
  const body = document.body;

  if(body && body.localName === 'frameset') {
    const noframes = document.querySelector('noframes');

    const newBody = document.createElement('body');

    if(noframes) {
      // TODO: fix encoding issues, maybe use textContent instead?
      // or use appendChild?
      newBody.innerHTML = noframes.innerHTML;
    } else {
      newBody.textContent = 'Unable to display document due to frames.';
    }

    document.documentElement.appendChild(newBody);
    body.remove();
  }

  const elements = document.querySelectorAll('frameset, frame, iframe');
  const numElements = elements.length;
  const root = document.documentElement;
  for(let i = 0, element; i < numElements; i++) {
    element = elements[i];
    if(root.contains(element)) {
      element.remove();
    }
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

    // TODO: no-op on SVG leads to large strange svg images appearing
    // in the output, maybe I just can't support, or maybe I somehow
    // enforce maximum dimensions

    if(elementName === 'svg' || elementName === 'path') {
      // NO-OP
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

const HIDDEN_SELECTOR = [
  '[style*="display:none"]',
  '[style*="display: none"]',
  '[style*="visibility:hidden"]',
  '[style*="visibility: hidden"]',
  '[style*="opacity:0.0"]',
  '[style*="opacity: 0.0"]',
  '[style*="opacity:0"]'
].join(',');

//TODO: include aria hidden?
// https://www.w3.org/TR/wai-aria/states_and_properties#aria-hidden
function filterHidden(document) {
  const elements = document.querySelectorAll(HIDDEN_SELECTOR);
  const numElements = elements.length;
  const root = document.documentElement;
  for(let i = 0, element; i < numElements; i++) {
    element = elements[i];
    if(root.contains(element)) {
      element.remove();
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

function filterLeaves(document) {
  const leafSet = new Set();
  collectLeaves(leafSet, document.body, document.documentElement);
  const rootElement = document.documentElement;
  for(let leaf of leafSet) {
    if(rootElement.contains(leaf)) {
      leaf.remove();
    }
  }
}

// TODO: no recursion
function collectLeaves(leaves, bodyElement, element) {
  const childNodes = element.childNodes;
  const numChildNodes = childNodes.length;
  for(let i = 0, cursor; i < numChildNodes; i++) {
    cursor = childNodes[i];
    if(cursor.nodeType === NODE_TYPE_ELEMENT) {
      if(isLeaf(bodyElement, cursor)) {
        leaves.add(cursor);
      } else {
        collectLeaves(leaves, bodyElement, cursor);
      }
    }
  }
}


// TODO: remove the bodyElement parameter
// TODO: non-recursive
function isLeaf(bodyElement, element) {
  if(element === bodyElement) {
    return false;
  }

  switch(element.localName) {
    case 'area':
    case 'audio':
    case 'br':
    case 'canvas':
    case 'col':
    case 'hr':
    case 'iframe':
    case 'img':
    case 'path':
    case 'source':
    case 'svg':
    case 'track':
    case 'video':
      return false;
    default:
      break;
  }

  const childNodes = element.childNodes;
  const numChildNodes = childNodes.length;
  for(let i = 0, node; i < numChildNodes; i++) {
    node = childNodes[i];
    if(node.nodeType === NODE_TYPE_TEXT) {
      switch(node.nodeValue) {
        case '':
        case '\n':
        case '\n\t':
        case '\n\t\t':
        case '\n\t\t\t':
        case '\n\t\t\t\t':
          break;
        default:
          return false;
      }
    } else if(node.nodeType === NODE_TYPE_ELEMENT) {
      if(!isLeaf(bodyElement, node)) {
        return false;
      }
    } else {
      return false;
    }
  }

  return true;
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
    switch(node.localName) {
      case 'br':
      case 'hr':
      case 'nobr':
        return true;
      case 'p':
        return !node.firstChild;
      default:
        break;
    }
  } else if(node.nodeType === NODE_TYPE_TEXT) {
    return node.nodeValue && node.nodeValue.trim();
  }

  return false;
}

function filterTexts(document) {
  const it = document.createNodeIterator(document.documentElement,
    NodeFilter.SHOW_TEXT);
  for(let node = it.nextNode(); node; node = it.nextNode()) {
    switch(node.nodeValue) {
      case '\n':
      case '\n\t':
      case '\n\t\t':
      case '\n\t\t\t':
        break;
      default:
        // Normalize whitespace
        node.nodeValue = node.nodeValue.replace(/&nbsp;/ig, ' ');
        break;
    }

    if(!node.parentNode.closest('code, pre, ruby, textarea, xmp')) {
      node.nodeValue = node.nodeValue.replace(/\s{2,}/g, ' ');
    }
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
