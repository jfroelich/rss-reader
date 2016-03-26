// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

// Lib for filtering the contents of an HTML Document object
// Requires: /src/utils.js
// TODO: merge table processing functions
// TODO: maybe use nodeName instead of localName?

(function IIFE_SANITIZE_DOCUMENT(exports) {
'use strict';

const BLACKLIST_SELECTOR = [
  'applet',
  'audio',
  'base',
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
  //'noembed',
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

// Inline elements that I want to unwrap. This is not all inline elements.
const INLINE_ELEMENT_SELECTOR = [
  'abbr',
  'acronym',
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
  //'noembed',
  //'rp',
  //'rt',
  //'rtc',
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

//TODO: include aria hidden?
// https://www.w3.org/TR/wai-aria/states_and_properties#aria-hidden
const HIDDEN_SELECTOR = [
  '[style*="display:none"]',
  '[style*="display: none"]',
  '[style*="visibility:hidden"]',
  '[style*="visibility: hidden"]',
  '[style*="opacity:0.0"]'
].join(',');

// TODO: explicit handling of noembed/audio/video/embed
// TODO: explicit handling of noscript
function sanitizeDocument(document) {

  filterComments(document);
  replaceFrames(document);

  const blacklistedElements = document.querySelectorAll(BLACKLIST_SELECTOR);
  utils.forEach(blacklistedElements, removeIfAttached);

  const hiddenElements = document.querySelectorAll(HIDDEN_SELECTOR);
  utils.forEach(hiddenElements, removeIfAttached);

  // utils.forEach(document.querySelectorAll('br'), filterBreakRule);
  const anchors = document.querySelectorAll('a');
  utils.forEach(anchors, filterAnchor);
  const images = document.querySelectorAll('img');
  const filterableImages = utils.filter(images, isFilterableImage);
  utils.forEach(filterableImages, utils.removeNode);

  // TODO: rename related inline stuff to filterUnwrappableElements? Because
  // the inline set is not exhaustive, there are some inlines that i do not
  // unwrap, and i also unwrap some elements that are not inline. Maybe this
  // is labeling it all wrong.
  // NOTE: currently naive is better perf. I think part of the problem is
  // that the attempt doubles some of its logic, and involves recursion
  const unwrapCount = filterInlineElementsNaive(document);
  //const unwrapCount = filterInlineElements(document);
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

function filterConsecutiveBreaks(document) {
  const TYPE_ELEMENT = Node.ELEMENT_NODE;
  const breaks = document.querySelectorAll('br');
  utils.forEach(breaks, function removePrevIfBreak(element) {
    const prev = element.previousSibling;
    if(prev && prev.nodeType === TYPE_ELEMENT && prev.localName === 'br') {
      prev.remove();
    }
  });
}

function filterComments(document) {
  const it = document.createNodeIterator(document.documentElement,
    NodeFilter.SHOW_COMMENT);
  for(let comment = it.nextNode(); comment; comment = it.nextNode()) {
    comment.remove();
  }
}

function removeIfAttached(element) {
  if(element.ownerDocument.documentElement.contains(element)) {
    element.remove();
  }
}

// TODO: research why content sometimes appears garbled, like encoded, as if
// it is re-encoding html
// TODO: this assumes that <frameset> means absense of body. What if both
// are present?
function replaceFrames(document) {
  const frameset = document.body;
  if(!frameset || frameset.localName !== 'frameset') {
    return;
  }

  console.debug('Replacing:', frameset.outerHTML);

  const body = document.createElement('body');
  const noframes = document.querySelector('noframes');
  if(noframes) {
    body.innerHTML = noframes.innerHTML;
  } else {
    body.textContent = 'Unable to display framed document.';
  }
  frameset.parentNode.replaceChild(frameset, body);
}

function filterBreakRule(element) {
  // TODO: improve, this is very buggy
  // error case: http://paulgraham.com/procrastination.html
  const parent = element.parentNode;
  const p = document.createElement('p');
  parent.replaceChild(p, element);
}

function filterAttributes(document) {
  const elements = document.getElementsByTagName('*');
  const numElements = elements.length;

  // Iterate attributes in reverse to avoid issues with mutating a live
  // NodeList during iteration

  // TODO: clean this up, make less dry,
  // maybe go back to using hash objects

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

// Unwraps all matching inline elements.
function filterInlineElementsNaive(document) {
  const elements = document.querySelectorAll(INLINE_ELEMENT_SELECTOR);
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
// TODO: think of a way to not call isInlineParent here and also in
// findShallowestInlineAncestor. Maybe there is some type of top down recusive
// approach that works similar to how filterLeaves works?
// TODO: figure out a way of repeatedly callin matches in isInlineParent
// TODO: figure out a way of not repeatedly trimming
function filterInlineElements(document) {
  const elements = document.querySelectorAll(INLINE_ELEMENT_SELECTOR);
  let unwrapCount = 0;
  for(let i = 0, len = elements.length, element, shallowest; i < len; i++) {
    element = elements[i];
    if(!isInlineParent(element)) {
      shallowest = findShallowestInlineAncestor(element);
      unwrap(element, shallowest);
      unwrapCount++;
    }
  }
  return unwrapCount;
}

// Recursive
function isInlineParent(element) {
  let result = element.matches(INLINE_ELEMENT_SELECTOR);
  for(let node = element.firstChild; result && node; node = node.nextSibling) {
    if(node.nodeType === Node.ELEMENT_NODE) {
      if(!isInlineParent(node)) {
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

function findShallowestInlineAncestor(element) {
  let shallowest = null;
  for(let node = element.parentNode; node && isInlineParent(node);
    node = node.parentNode) {
    shallowest = node;
  }
  return shallowest;
}

function filterLeaves(document) {
  const elements = document.querySelectorAll('*');
  const numElements = elements.length;
  const docElement = document.documentElement;

  // The contains check avoids removing nodes that are descendants of nodes
  // removed in prior iteration

  for(let i = 0, element; i < numElements; i++) {
    element = elements[i];
    if(docElement.contains(element) && isLeaf(element)) {
      element.remove();
    }
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

// Recursive
function isLeaf(element) {
  if(element.localName in LEAF_EXCEPTIONS) {
    return false;
  }

  const TEXT_NODE = Node.TEXT_NODE;
  const ELEMENT_NODE = Node.ELEMENT_NODE;

  // An element is a leaf unless it contains a non-leaf child node
  for(let node = element.firstChild; node; node = node.nextSibling) {
    switch(node.nodeType) {
      case TEXT_NODE:
        // An element is not a leaf if it contains a non-empty text node
        if(node.nodeValue.trim()) {
          return false;
        }
        break;
      case ELEMENT_NODE:
        // An element is not a leaf if it contains a non-leaf child element
        if(!isLeaf(node)) {
          return false;
        }
        break;
      default:
        // An element is not a leaf if it contains an unknown node type
        return false;
    }
  }

  return true;
}

function filterAnchor(anchor) {
  const jspattern = /\s*javascript\s*:/i;
  const minjslen = 'javascript:'.length - 1;
  // NOTE: accessing anchor.protocol performs even worse than
  // using a regexp.
  if(anchor.hasAttribute('href')) {
    const href = anchor.getAttribute('href');
    if(href.length > minjslen && jspattern.test(href)) {
      // NOTE: consider removing or unwrapping
      anchor.setAttribute('href', '');
    }
  } else if(anchor.hasAttribute('name')) {
    // It is a named anchor without an href. Ignore it.
  } else {
    // The anchor is nominal, and can be treated like a span or any other
    // inline element. Unwrap it.
    unwrap(anchor);
  }
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

function filterConsecutiveRules(document) {
  for(let i = 0, rules = document.querySelectorAll('hr'), len = rules.length,
    rule, previousSibling; i < len; i++) {
    rule = rules[i];
    previousSibling = rule.previousSibling;
    if(previousSibling && previousSibling.nodeType === Node.ELEMENT_NODE &&
      previousSibling.localName === 'hr') {
      rule.remove();
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

  return (node.nodeType === Node.ELEMENT_NODE &&
    node.localName in TRIMMABLE_ELEMENTS) ||
    (node.nodeType === Node.TEXT_NODE && !node.nodeValue.trim());
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
      value = condenseWhitespace(value);
    }
    node.nodeValue = value;
  }
}

function canonicalizeWhitespace(value) {
  return value.replace(/&nbsp;/ig, ' ');
}

function condenseWhitespace(value) {
  return value.replace(/\s{2,}/g, ' ');
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
