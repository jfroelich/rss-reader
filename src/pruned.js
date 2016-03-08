// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

// TODO: merge table processing functions
// TODO: merge text node processing functions

var pruned_blacklist = [
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

var pruned_INLINE_ELEMENT_NAMES = new Set([
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
]);

var pruned_INLINE_ELEMENTS_SELECTOR = Array.from(
  pruned_INLINE_ELEMENT_NAMES).join(',');

// Filters various nodes from a document
function pruned_transform(document) {
  'use strict';
  pruned_filterComments(document);
  pruned_filterFrames(document);
  pruned_applyBlacklist(document);
  pruned_filterHidden(document);

  const calamine = new Calamine();
  calamine.analyze(document);
  calamine.prune();

  pruned_filterAnchors(document);
  pruned_filterBRs(document);
  pruned_filterImages(document);
  pruned_normalizeWhitespace(document);
  pruned_filterInlines(document);
  pruned_condenseValues(document);
  pruned_trimNodes(document);
  pruned_filterEmptyTextNodes(document);
  pruned_filterLeaves(document);
  pruned_filterLists(document);
  pruned_filterSingleCellTables(document);
  pruned_filterSingleColumnTables(document);
  pruned_trimDocument(document);
  pruned_filterAttributes(document);
}

function pruned_filterComments(document) {
  'use strict';
  const it = document.createNodeIterator(document.documentElement,
    NodeFilter.SHOW_COMMENT);
  for(let node = it.nextNode(); node; node = it.nextNode()) {
    node.remove();
  }
}

function pruned_applyBlacklist(document) {
  'use strict';
  const selector = pruned_blacklist.join(',');
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


function pruned_filterFrames(document) {
  'use strict';
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

function pruned_filterBRs(document) {
  'use strict';

  // This is buggy, temporarily a NO-OP.
  if(true) {
    return;
  }

  // TODO: improve
  // error case: http://paulgraham.com/procrastination.html

  const elements = document.querySelectorAll('br');
  const numElements = elements.length;
  for(let i = 0, element, parent, p; i < numElements; i++) {
    element = elements[i];
    parent = element.parentNode;
    p = document.createElement('p');
    parent.replaceChild(p, element);
  }
}

function pruned_filterAttributes(document) {
  'use strict';
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

function pruned_filterHidden(document) {
  'use strict';
  //TODO: include aria hidden?
  // https://www.w3.org/TR/wai-aria/states_and_properties#aria-hidden
  const selector = [
    '[style*="display:none"]',
    '[style*="display: none"]',
    '[style*="visibility:hidden"]',
    '[style*="visibility: hidden"]',
    '[style*="opacity:0.0"]',
    '[style*="opacity: 0.0"]',
    '[style*="opacity:0"]'
  ].join(',');

  const elements = document.querySelectorAll(selector);
  const numElements = elements.length;
  const root = document.documentElement;
  for(let i = 0, element; i < numElements; i++) {
    element = elements[i];
    if(root.contains(element)) {
      element.remove();
    }
  }
}

function pruned_filterInlines(document) {
  'use strict';

  const inlines = pruned_INLINE_ELEMENT_NAMES;
  const selector = pruned_INLINE_ELEMENTS_SELECTOR;
  const elements = document.querySelectorAll(selector);
  const numElements = elements.length;

  for(let i = 0, element, farthest, cursor; i < numElements; i++) {
    element = elements[i];
    // TODO: why am i testing inlines.has in the first part of this
    // if, when i know it is inline from the query selector?
    if(element.childNodes.length === 1 &&
      inlines.has(element.firstChild.localName)) {
      // Skip
    } else {
      farthest = null;
      for(cursor = element.parentNode; cursor &&
        inlines.has(cursor.localName) &&
        cursor.childNodes.length === 1 &&
        inlines.has(cursor.firstChild.localName);
        cursor = cursor.parentNode) {
        farthest = cursor;
      }
      pruned_unwrap(element, farthest);
    }
  }
}

function pruned_filterLeaves(document) {
  'use strict';
  const leafSet = new Set();
  pruned_collectLeaves(leafSet, document.body,
    document.documentElement);
  const rootElement = document.documentElement;
  for(let leaf of leafSet) {
    if(rootElement.contains(leaf)) {
      leaf.remove();
    }
  }
}

// TODO: no recursion
function pruned_collectLeaves(leaves, bodyElement, element) {
  'use strict';
  const childNodes = element.childNodes;
  const numChildNodes = childNodes.length;
  for(let i = 0, cursor; i < numChildNodes; i++) {
    cursor = childNodes[i];
    if(cursor.nodeType === Node.ELEMENT_NODE) {
      if(pruned_isLeafElement(bodyElement, cursor)) {
        leaves.add(cursor);
      } else {
        pruned_collectLeaves(leaves, bodyElement, cursor);
      }
    }
  }
}

// TODO: remove the bodyElement parameter
// TODO: non-recursive
function pruned_isLeafElement(bodyElement, element) {
  'use strict';

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
    if(node.nodeType === Node.TEXT_NODE) {
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
    } else if(node.nodeType === Node.ELEMENT_NODE) {
      if(!pruned_isLeafElement(bodyElement, node)) {
        return false;
      }
    } else {
      return false;
    }
  }

  return true;
}

function pruned_filterAnchors(document) {
  'use strict';
  const elements = document.querySelectorAll('a');
  const numElements = elements.length;
  const JSPROTOCOL = /\s*javascript\s*:/i;
  for(let i = 0, anchor; i < elements.length; i++) {
    anchor = elements[i];
    if(!anchor.hasAttribute('name') && !anchor.hasAttribute('href')) {
      // It is a nominal anchor, unwrap
      pruned_unwrap(anchor);
    } else if(anchor.hasAttribute('href') &&
      JSPROTOCOL.test(anchor.getAttribute('href'))) {
      // If it is a javascript anchor, remove the link
      // TODO: maybe unwrap or remove?
      anchor.setAttribute('href', '');
    }
  }
}

function pruned_filterSingleCellTables(document) {
  'use strict';
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
        pruned_insertChildrenBefore(cell, table);
        parent.insertBefore(document.createTextNode(' '), table);
        table.remove();
      }
    }
  }
}

// Transforms single column tables into paragraph separated row content
function pruned_filterSingleColumnTables(document) {
  'use strict';
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
      pruned_transformSingleColumnTable(table);
    }
  }
}

function pruned_transformSingleColumnTable(table) {
  'use strict';
  const parent = table.parentNode;
  const document = table.ownerDocument;
  for(let rows = table.rows, numRows = rows.length, rowIndex = 0,
    columnIndex = 0, cell, cells, numCells = 0;
    rowIndex < numRows; rowIndex++) {
    for(columnIndex = 0, cells = rows[rowIndex], numCells = cells.length;
      columnIndex < numCells; columnIndex++) {
      cell = cells[columnIndex];
      pruned_insertChildrenBefore(cell, table);
    }

    parent.insertBefore(document.createElement('p'), table);
  }

  table.remove();
}

function pruned_filterLists(document) {
  'use strict';
  const lists = document.querySelectorAll('ul, ol');
  const numLists = lists.length;
  for(let i = 0, list, node, item; i < numLists; i++) {
    list = lists[i];
    if(list.childElementCount === 1) {
      item = list.firstElementChild;
      if(item.localName === 'li') {
        pruned_insertChildrenBefore(item, list);
        list.remove();
      }
    }
  }
}

function pruned_filterImages(document) {
  'use strict';
  const images = document.querySelectorAll('img');
  const numImages = images.length;
  for(let i = 0, image; i < numImages; i++) {
    image = images[i];
    if(!image.hasAttribute('src') && !image.hasAttribute('srcset')) {
      // images must have a source
      image.remove();
    } else if(image.width < 2 || image.height < 2) {
      // it is probably a tracer
      image.remove();
    }
  }
}

function pruned_normalizeWhitespace(document) {
  'use strict';
  const it = document.createNodeIterator(document.documentElement,
    NodeFilter.SHOW_TEXT);
  const NBSP_PATTERN = /&nbsp;/ig;
  for(let value = '', node = it.nextNode(); node; node = it.nextNode()) {
    value = node.nodeValue;
    switch(value) {
      case '':
      case '\n':
      case '\n\t':
      case '\n\t\t':
      case '\n\t\t\t':
      case '\n\t\t\t\t':
        break;
      default:
        node.nodeValue = value.replace(NBSP_PATTERN, ' ');
        break;
    }
  }
}

function pruned_condenseValues(document) {
  'use strict';
  const it = document.createNodeIterator(document.documentElement,
    NodeFilter.SHOW_TEXT);
  const TWO_OR_MORE_SPACES = /\s{2,}/g;
  for(let node = it.nextNode(); node; node = it.nextNode()) {
    if(node.nodeValue && !pruned_isWhitespaceSensitive(node)) {
      node.nodeValue = node.nodeValue.replace(TWO_OR_MORE_SPACES, ' ');
    }
  }
}

function pruned_isWhitespaceSensitive(textNode) {
  'use strict';
  return textNode.parentNode.closest('code, pre, ruby, textarea, xmp');
}

function pruned_trimDocument(document) {
  'use strict';
  const body = document.body;
  if(body) {
    let sibling = body;
    let node = body.firstChild;
    while(node && pruned_isTrimmableNode(node)) {
      sibling = node.nextSibling;
      node.remove();
      node = sibling;
    }

    node = body.lastChild;
    while(node && pruned_isTrimmableNode(node)) {
      sibling = node.previousSibling;
      node.remove();
      node = sibling;
    }
  }
}

function pruned_isTrimmableNode(node) {
  'use strict';
  if(node.nodeType === Node.ELEMENT_NODE) {
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
  } else if(node.nodeType === Node.TEXT_NODE) {
    return node.nodeValue && node.nodeValue.trim();
  }

  return false;
}

function pruned_trimNodes(document) {
  'use strict';
  const it = document.createNodeIterator(document.documentElement,
    NodeFilter.SHOW_TEXT);
  for(let node = it.nextNode(); node; node = it.nextNode()) {

    if(pruned_isWhitespaceSensitive(node)) {
      continue;
    }

    if(node.previousSibling) {
      if(node.previousSibling.nodeType === Node.ELEMENT_NODE) {
        if(pruned_isNoTrimInlineElement(node.previousSibling)) {
          if(node.nextSibling) {
            if(node.nextSibling.nodeType === Node.ELEMENT_NODE) {
              if(!pruned_isNoTrimInlineElement(node.nextSibling)) {
                node.nodeValue = node.nodeValue.trimRight();
              }
            }
          } else {
            node.nodeValue = node.nodeValue.trimRight();
          }
        } else {
          node.nodeValue = node.nodeValue.trim();
        }
      } else {
       if(node.nextSibling) {
          if(node.nextSibling.nodeType === Node.ELEMENT_NODE) {
            if(pruned_isNoTrimInlineElement(node.nextSibling)) {
            } else {
             node.nodeValue = node.nodeValue.trimRight();
            }
          }
        } else {
          node.nodeValue = node.nodeValue.trimRight();
        }
      }
    } else if(node.nextSibling) {
     if(node.nextSibling.nodeType === Node.ELEMENT_NODE) {
        if(pruned_isNoTrimInlineElement(node.nextSibling)) {
          node.nodeValue = node.nodeValue.trimLeft();
        } else {
          node.nodeValue = node.nodeValue.trim();
        }
      } else {
        node.nodeValue = node.nodeValue.trimLeft();
      }
    } else {
      node.nodeValue = node.nodeValue.trimLeft();
    }
  }
}

function pruned_filterEmptyTextNodes(document) {
  'use strict';
  const it = document.createNodeIterator(document.documentElement,
    NodeFilter.SHOW_TEXT);
  for(let node = it.nextNode(); node; node = it.nextNode()) {
    if(!node.nodeValue) {
      node.remove();
    }
  }
}

function pruned_isNoTrimInlineElement(element) {
  'use strict';

  switch(element.localName) {
    case 'a':
    case 'abbr':
    case 'acronym':
    case 'address':
    case 'b':
    case 'bdi':
    case 'bdo':
    case 'blink':
    case 'cite':
    case 'code':
    case 'data':
    case 'del':
    case 'dfn':
    case 'em':
    case 'font':
    case 'i':
    case 'ins':
    case 'kbd':
    case 'mark':
    case 'map':
    case 'meter':
    case 'q':
    case 'rp':
    case 'rt':
    case 'samp':
    case 'small':
    case 'span':
    case 'strike':
    case 'strong':
    case 'sub':
    case 'sup':
    case 'time':
    case 'tt':
    case 'u':
    case 'var':
      return true;
    default:
      break;
  }

  return false;
}

// Unwraps the element's child nodes into the parent of the element or, if
// provided, the parent of the alternate element
function pruned_unwrap(element, alternate) {
  'use strict';
  const target = alternate || element;
  const parent = target.parentNode;
  if(!parent || !element.childNodes.length) {
    element.remove();
    return;
  }
  const document = element.ownerDocument;
  const ps = target.previousSibling;
  if(ps && ps.nodeType === Node.TEXT_NODE) {
    parent.insertBefore(document.createTextNode(' '), target);
  }
  pruned_insertChildrenBefore(element, target);
  const ns = target.nextSibling;
  if(ns && ns.nodeType === Node.TEXT_NODE) {
    parent.insertBefore(document.createTextNode(' '), target);
  }
  target.remove();
}

function pruned_insertChildrenBefore(parentNode, referenceNode) {
  'use strict';
  const referenceParent = referenceNode.parentNode;
  for(let node = parentNode.firstChild; node; node = parentNode.firstChild) {
    referenceParent.insertBefore(node, referenceNode);
  }
}
