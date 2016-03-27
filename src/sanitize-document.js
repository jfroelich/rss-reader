// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

// Lib for filtering the contents of an HTML Document object

(function IIFE_SANITIZE_DOCUMENT(exports) {
'use strict';

const BLACKLIST_SELECTOR = [
  'APPLET', 'AUDIO', 'BASE', 'BASEFONT', 'BGSOUND', 'BUTTON', 'COMMAND',
  'DATALIST', 'DIALOG', 'EMBED', 'FIELDSET', 'FRAME', 'FRAMESET', 'HEAD',
  'IFRAME', 'INPUT', 'ISINDEX', 'LINK', 'MATH', 'META', 'NOSCRIPT',
  'OBJECT', 'OUTPUT', 'OPTGROUP', 'OPTION', 'PARAM', 'PATH', 'PROGRESS',
  'SCRIPT', 'SELECT', 'SPACER', 'STYLE', 'SVG', 'TEXTAREA', 'TITLE',
  'VIDEO', 'XMP'
].join(',');

// Elements to unwrap
const UNWRAPPABLE_SELECTOR = [
  'ABBR', 'ACRONYM', 'ARTICLE', 'ASIDE', 'CENTER', 'COLGROUP', 'DATA',
  'DETAILS', 'DIV', 'FOOTER', 'HEADER', 'HELP', 'HGROUP', 'ILAYER',
  'INSERT', 'LAYER', 'LEGEND', 'MAIN', 'MARK', 'MARQUEE', 'METER',
  'MULTICOL', 'NOBR', 'SECTION', 'SPAN', 'TBODY', 'TFOOT', 'THEAD', 'FORM',
  'LABEL', 'BIG', 'BLINK', 'FONT', 'PLAINTEXT', 'SMALL', 'TT'
].join(',');

//TODO: include aria hidden?
// https://www.w3.org/TR/wai-aria/states_and_properties#aria-hidden
const HIDDEN_SELECTOR = [
  '[style*="display:none"]', '[style*="display: none"]',
  '[style*="visibility:hidden"]', '[style*="visibility: hidden"]',
  '[style*="opacity:0.0"]'
].join(',');

// TODO: explicit handling of noembed/audio/video/embed
// TODO: explicit handling of noscript
function sanitizeDocument(document) {

  filterComments(document);
  replaceFrames(document);
  filterBlacklistedElements(document);
  filterHiddenElements(document);
  //replaceBreakRuleElements(document);
  filterAnchors(document);
  filterImages(document);

  // NOTE: currently naive is better perf. I think part of the problem is
  // that the attempt doubles some of its logic, and involves recursion
  const unwrapCount = filterUnwrappablesNaive(document);
  //const unwrapCount = filterUnwrappables(document);
  //console.debug('Unwrapped %s elements', unwrapCount);

  filterTexts(document);
  filterLists(document);
  filterConsecutiveRules(document);
  unwrapSingleCellTables(document);
  filterSingleColumnTables(document);
  filterLeaves(document);
  filterConsecutiveBreaks(document);
  trimDocument(document);
  filterAttributes(document);
}

exports.sanitizeDocument = sanitizeDocument;

function filterBlacklistedElements(document) {
  const elements = document.querySelectorAll(BLACKLIST_SELECTOR);
  const docElement = document.documentElement;
  for(let i = 0, len = elements.length, element; i < len; i++) {
    element = elements[i];
    if(docElement.contains(element)) {
      element.remove();
    }
  }
}

function filterHiddenElements(document) {
  const elements = document.querySelectorAll(HIDDEN_SELECTOR);
  const docElement = document.documentElement;
  for(let i = 0, len = elements.length, element; i < len; i++) {
    element = elements[i];
    if(docElement.contains(element)) {
      element.remove();
    }
  }
}

function filterComments(document) {
  const it = document.createNodeIterator(document.documentElement,
    NodeFilter.SHOW_COMMENT);
  for(let comment = it.nextNode(); comment; comment = it.nextNode()) {
    comment.remove();
  }
}

// TODO: research why content sometimes appears garbled, like encoded, as if
// it is re-encoding html
// TODO: this assumes that <frameset> means absense of body. What if both
// are present?
function replaceFrames(document) {
  const frameset = document.body;
  if(!frameset || frameset.nodeName !== 'FRAMESET') {
    return;
  }

  console.debug('Replacing:', frameset.outerHTML);

  const body = document.createElement('BODY');
  const noframes = document.querySelector('NOFRAMES');
  if(noframes) {
    body.innerHTML = noframes.innerHTML;
  } else {
    body.textContent = 'Unable to display framed document.';
  }
  frameset.parentNode.replaceChild(frameset, body);
}


// TODO: clean this up, make less dry
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
    elementName = element.nodeName;
    attributes = element.attributes;
    if(!attributes || !attributes.length) {
      continue;
    }

    if(elementName === 'SOURCE') {
      for(j = attributes.length - 1; j > -1; j--) {
        attributeName = attributes[j].name;
        if(attributeName !== 'type' && attributeName !== 'srcset' &&
          attributeName !== 'sizes' && attributeName !== 'media' &&
          attributeName !== 'src') {
          element.removeAttribute(attributeName);
        }
      }
    } else if(elementName === 'A') {
      for(j = attributes.length - 1; j > -1; j--) {
        attributeName = attributes[j].name;
        if(attributeName !== 'href' && attributeName !== 'name' &&
          attributeName !== 'title') {
          element.removeAttribute(attributeName);
        }
      }
    } else if(elementName === 'IFRAME') {
      for(j = attributes.length - 1; j > -1; j--) {
        attributeName = attributes[j].name;
        if(attributeName !== 'src') {
          element.removeAttribute(attributeName);
        }
      }
    } else if(elementName === 'IMG') {
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

function filterUnwrappablesNaive(document) {
  const elements = document.querySelectorAll(UNWRAPPABLE_SELECTOR);
  const numElements = elements.length;
  for(let i = 0; i < numElements; i++) {
    unwrap(elements[i], null);
  }
  return numElements;
}

// Unwrapping has shown to be pretty expensive.
// Rather than simply unwrap all the inline elements, this tries to reduce
// the number of calls to unwrap by allowing for unwrapping at a distance.
// For example, in <p><a><b>text</b></a></p>, instead of unwrapping a and
// then unwrapping b, we skip over a, and we unwrap b's content into p,
// and delete a.
// TODO: think of a way to not call isUnwrappableParent here and also in
// findShallowestUnwrappableAncestor. Maybe there is some type of top down
// recusive approach that works similar to how filterLeaves works?
// TODO: figure out a way of repeatedly callin matches in isUnwrappableParent
// TODO: figure out a way of not repeatedly trimming
function filterUnwrappables(document) {
  const elements = document.querySelectorAll(UNWRAPPABLE_SELECTOR);
  let unwrapCount = 0;
  for(let i = 0, len = elements.length, element, shallowest; i < len; i++) {
    element = elements[i];
    if(!isUnwrappableParent(element)) {
      shallowest = findShallowestUnwrappableAncestor(element);
      unwrap(element, shallowest);
      unwrapCount++;
    }
  }
  return unwrapCount;
}

function isUnwrappableParent(element) {
  let result = element.matches(UNWRAPPABLE_SELECTOR);
  for(let node = element.firstChild; result && node; node = node.nextSibling) {
    if(node.nodeType === Node.ELEMENT_NODE) {
      if(!isUnwrappableParent(node)) {
        result = false;
      }
    } else if(node.nodeType === Node.TEXT_NODE) {
      if(node.nodeValue.trim()) {
        result = false;
      }
    }
  }
  return result;
}

function findShallowestUnwrappableAncestor(element) {
  let shallowest = null;
  for(let node = element.parentNode; node && isUnwrappableParent(node);
    node = node.parentNode) {
    shallowest = node;
  }
  return shallowest;
}

function filterLeaves(document) {
  const elements = document.querySelectorAll('*');
  const numElements = elements.length;
  const docElement = document.documentElement;
  for(let i = 0, element; i < numElements; i++) {
    element = elements[i];
    if(docElement.contains(element) && isLeaf(element)) {
      element.remove();
    }
  }
}

const LEAF_EXCEPTIONS = {
  'AREA': 1, 'AUDIO': 1, 'BASE': 1, 'COL': 1, 'COMMAND': 1, 'BR': 1,
  'CANVAS': 1, 'COL': 1, 'HR': 1, 'IFRAME': 1, 'IMG': 1, 'INPUT': 1,
  'KEYGEN': 1, 'META': 1, 'NOBR': 1, 'PARAM': 1, 'PATH': 1, 'SOURCE': 1,
  'SBG': 1, 'TEXTAREA': 1, 'TRACK': 1, 'VIDEO': 1, 'WBR': 1
};

// Recursive
function isLeaf(element) {
  if(element.nodeName in LEAF_EXCEPTIONS) {
    return false;
  }

  const TEXT_NODE = Node.TEXT_NODE;
  const ELEMENT_NODE = Node.ELEMENT_NODE;

  // An element is a leaf unless it contains a non-leaf child node
  for(let node = element.firstChild; node; node = node.nextSibling) {
    switch(node.nodeType) {
      case TEXT_NODE:
        if(node.nodeValue.trim()) {
          return false;
        }
        break;
      case ELEMENT_NODE:
        if(!isLeaf(node)) {
          return false;
        }
        break;
      default:
        return false;
    }
  }

  return true;
}

// NOTE: testing whether anchor.protocol === 'javascript:' is slower than
// using a regular expression.
function filterAnchors(document) {
  const anchors = document.querySelectorAll('A');
  const jspattern = /^\s*JAVASCRIPT\s*:/i;
  const MIN_HREF_LEN = 'JAVASCRIPT:'.length - 1;

  for(let i = 0, len = anchors.length, anchor, href; i < len; i++) {
    anchor = anchors[i];

    if(anchor.hasAttribute('href')) {
      href = anchor.getAttribute('href');
      if(href.length > MIN_HREF_LEN && jspattern.test(href)) {
        // NOTE: consider removing or unwrapping
        anchor.setAttribute('href', '');
      }
    } else if(anchor.hasAttribute('name')) {
      // Leave as is
    } else {
      // Nominal
      unwrap(anchor);
    }
  }
}

// TODO: merge table processing functions
function unwrapSingleCellTables(document) {
  const tables = document.querySelectorAll('TABLE');
  for(let i = 0, len = tables.length; i < len; i++) {
    unwrapTableIfSingleCell(tables[i]);
  }

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
  const tables = document.querySelectorAll('TABLE');
  for(let i = 0, len = tables.length; i < len; i++) {
    filterTableIfSingleColumn(tables[i]);
  }
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

      parent.insertBefore(document.createElement('P'), table);
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
  const lists = document.querySelectorAll('UL, OL');
  for(let i = 0, len = lists.length; i < len; i++) {
    unwrapSingleItemList(lists[i]);
  }
}

function unwrapSingleItemList(list) {
  if(list.childElementCount === 1) {
    const item = list.firstElementChild;
    if(item.nodeName === 'LI') {
      insertChildrenBefore(item, list);
      list.remove();
    }
  }
}

function filterConsecutiveRules(document) {
  for(let i = 0, rules = document.querySelectorAll('HR'), len = rules.length,
    rule, prev; i < len; i++) {
    prev = rules[i].previousSibling;
    if(prev && prev.nodeName === 'HR') {
      prev.remove();
    }
  }
}

function filterConsecutiveBreaks(document) {
  const breaks = document.querySelectorAll('BR');
  for(let i = 0, len = breaks.length, prev; i < len; i++) {
    prev = breaks[i].previousSibling;
    if(prev && prev.nodeName === 'BR') {
      prev.remove();
    }
  }
}

function replaceBreakRuleElements(document) {
  const elements = document.querySelectorAll('BR');
  for(let i = 0, len = elements.length, element; i < len; i++) {
    element = elements[i];
    filterBreakRule(element);
  }
}


// TODO: improve, this is very buggy
// error case: http://paulgraham.com/procrastination.html
function filterBreakRule(element) {
  const parent = element.parentNode;
  const p = document.createElement('P');
  parent.replaceChild(p, element);
}

function filterImages(document) {
  const images = document.querySelectorAll('IMG');
  for(let i = 0, len = images.length, image; i < len; i++) {
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
    const firstChild = body.firstChild;
    if(firstChild) {
      removeNodesByStep(firstChild, 'nextSibling');
      const lastChild = body.lastChild;
      if(lastChild && lastChild !== firstChild) {
        removeNodesByStep(body.lastChild, 'previousSibling');
      }
    }
  }
}

function removeNodesByStep(startNode, step) {
  const VOIDS = {'BR': 1, 'HR': 1, 'NOBR': 1};
  const ELEMENT = Node.ELEMENT_NODE;
  const TEXT = Node.TEXT_NODE;
  let node = startNode, sibling = startNode;
  while(node && ((node.nodeType === ELEMENT && node.nodeName in VOIDS) ||
    (node.nodeType === TEXT && !node.nodeValue.trim()))) {
    sibling = node[step];
    node.remove();
    node = sibling;
  }
}

function filterTexts(document) {
  const iterator = document.createNodeIterator(document.documentElement,
    NodeFilter.SHOW_TEXT);
  const SENSITIVE_SELECTOR = 'CODE, PRE, RUBY, TEXTAREA, XMP';
  for(let node = iterator.nextNode(), value, length = 0; node;
    node = iterator.nextNode()) {
    value = node.nodeValue;
    length = value.length;
    if(length > 3) {
      if(length > 5) {
        value = value.replace(/&nbsp;/ig, ' ');
      }
      if(!node.parentNode.closest(SENSITIVE_SELECTOR)) {
        value = value.replace(/\s{2,}/g, ' ');
      }
      node.nodeValue = value;
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
    if(prevSibling && prevSibling.nodeType === Node.TEXT_NODE) {
      parent.insertBefore(document.createTextNode(' '), target);
    }
    insertChildrenBefore(element, target);
    if(nextSibling && nextSibling.nodeType === Node.TEXT_NODE) {
      parent.insertBefore(document.createTextNode(' '), target);
    }
  }
  target.remove();
}

function insertChildrenBefore(parentNode, referenceNode) {
  const referenceParent = referenceNode.parentNode;
  for(let node = parentNode.firstChild; node; node = parentNode.firstChild) {
    referenceParent.insertBefore(node, referenceNode);
  }
}

}(this));
