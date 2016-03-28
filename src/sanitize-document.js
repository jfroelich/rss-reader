// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

// Lib for filtering the contents of an HTML Document object
// Requires: /src/sanitize-unwrap.js

// TODO: explicit handling of noembed/audio/video/embed
// TODO: explicit handling of noscript
// TODO: include aria hidden in HIDDEN_SELECTOR?
// https://www.w3.org/TR/wai-aria/states_and_properties#aria-hidden
// TODO: research why content sometimes appears garbled, like encoded, as if
// it is re-encoding html, when using content of noframes in replaceFrames
// TODO: what if both body and frameset are present in replaceFrames ?
// TODO: make filterAttributes less dry
// TODO: maybe blacklist all urls not using an acceptable protocol in
// filterAnchors

(function(exports) {
'use strict';

const BLACKLIST_SELECTOR = [
  'APPLET', 'AUDIO', 'BASE', 'BASEFONT', 'BGSOUND', 'BUTTON', 'COMMAND',
  'DATALIST', 'DIALOG', 'EMBED', 'FIELDSET', 'FRAME', 'FRAMESET', 'HEAD',
  'IFRAME', 'INPUT', 'ISINDEX', 'LINK', 'MATH', 'META', 'NOSCRIPT',
  'OBJECT', 'OUTPUT', 'OPTGROUP', 'OPTION', 'PARAM', 'PATH', 'PROGRESS',
  'SCRIPT', 'SELECT', 'SPACER', 'STYLE', 'SVG', 'TEXTAREA', 'TITLE',
  'VIDEO', 'XMP'
].join(',');

const HIDDEN_SELECTOR = [
  '[style*="display:none"]', '[style*="display: none"]',
  '[style*="visibility:hidden"]', '[style*="visibility: hidden"]',
  '[style*="opacity:0.0"]'
].join(',');

function sanitizeDocument(document) {
  filterComments(document);
  replaceFrames(document);
  filterBlacklistedElements(document);
  filterHiddenElements(document);
  //replaceBreakRuleElements(document);
  filterAnchors(document);
  filterImages(document);
  filterUnwrappables(document);
  filterTexts(document);
  filterLists(document);
  filterTables(document);
  filterLeaves(document);
  filterConsecutiveRules(document);
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

function replaceFrames(document) {
  const frameset = document.body;
  if(!frameset || frameset.nodeName !== 'FRAMESET') {
    return;
  }

  const body = document.createElement('BODY');
  const noframes = document.querySelector('NOFRAMES');
  if(noframes) {
    body.innerHTML = noframes.innerHTML;
  } else {
    body.textContent = 'Unable to display framed document.';
  }
  frameset.parentNode.replaceChild(frameset, body);
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

function isLeaf(element) {
  if(element.nodeName in LEAF_EXCEPTIONS) {
    return false;
  }

  const TEXT_NODE = Node.TEXT_NODE,
    ELEMENT_NODE = Node.ELEMENT_NODE;

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
  const MIN_HREF_LEN = 'JAVASCRIPT'.length;

  for(let i = 0, len = anchors.length, anchor, href; i < len; i++) {
    anchor = anchors[i];
    if(anchor.hasAttribute('href')) {
      href = anchor.getAttribute('href');
      if(href.length > MIN_HREF_LEN && jspattern.test(href)) {
        // NOTE: consider removing or unwrapping
        anchor.setAttribute('href', '');
      }
    } else if(!anchor.hasAttribute('name')) {
      unwrap(anchor);
    }
  }
}

// TODO: what about skipping past empty rows and still unwrapping when
// processing single cell tables?
function filterTables(document) {
  const tables = document.querySelectorAll('TABLE');
  const tableLength = tables.length;
  let rows = null;
  let cells = null;
  let cell = null;
  let tableParent = null;
  let table = null;
  let isSingleColumn = true;
  let upperBound = 0;
  let tableIndex = 0;
  let rowIndex = 0;
  let colIndex = 0;
  let rowLength = 0;

  for(tableIndex = 0; tableIndex < tableLength; tableIndex++) {
    table = tables[tableIndex];
    tableParent = table.parentNode;
    rows = table.rows;
    rowLength = rows.length;

    if(rowLength === 1) {
      cells = rows[0].cells;
      if(cells.length === 1) {
        cell = cells[0];
        tableParent.insertBefore(document.createTextNode(' '), table);
        insertChildrenBefore(cell, table);
        tableParent.insertBefore(document.createTextNode(' '), table);
        table.remove();
        continue;
      }
    }

    isSingleColumn = true;
    upperBound = Math.min(rowLength, 50);
    for(rowIndex = 0; rowIndex < upperBound; rowIndex++) {
      if(rows[rowIndex].cells.length > 1) {
        isSingleColumn = false;
        break;
      }
    }

    if(isSingleColumn) {
      // console.debug('Unwrapping single column table', table);
      tableParent.insertBefore(document.createTextNode(' '), table);
      for(rowIndex = 0; rowIndex < rowLength; rowIndex++) {
        cells = rows[rowIndex];
        for(colIndex = 0; colIndex < cells.length; colIndex++) {
          insertChildrenBefore(cells[colIndex], table);
        }
        tableParent.insertBefore(document.createElement('P'), table);
      }
      tableParent.insertBefore(document.createTextNode(' '), table);
      table.remove();
    }
  }
}

function filterLists(document) {
  const lists = document.querySelectorAll('UL, OL');
  for(let i = 0, len = lists.length, list, item; i < len; i++) {
    list = lists[i];
    if(list.childElementCount === 1) {
      item = list.firstElementChild;
      if(item.nodeName === 'LI') {
        insertChildrenBefore(item, list);
        list.remove();
      }
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
      removeTrimmableNodesByStep(firstChild, 'nextSibling');
      const lastChild = body.lastChild;
      if(lastChild && lastChild !== firstChild) {
        removeTrimmableNodesByStep(body.lastChild, 'previousSibling');
      }
    }
  }
}

function removeTrimmableNodesByStep(startNode, step) {
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

}(this));
