// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

var rdr = rdr || {};
rdr.cleandom = {};

rdr.cleandom.cleanDoc = function(doc) {
  rdr.cleandom.filterComments(doc);
  rdr.cleandom.filterFrames(doc);
  rdr.cleandom.filterNoscripts(doc);
  rdr.cleandom.filterBlacklistedElements(doc);
  rdr.cleandom.filterHidden(doc);
  rdr.cleandom.adjustBlockInlineElements(doc);
  rdr.cleandom.filterBreaks(doc);
  rdr.cleandom.unwrapScriptAnchors(doc);
  rdr.cleandom.unwrapFormattingAnchors(doc);
  rdr.cleandom.filterSmallImages(doc);
  rdr.cleandom.filterSourcelessImages(doc);
  rdr.cleandom.filterUnwrappables(doc);
  rdr.cleandom.filterFigures(doc);
  rdr.cleandom.filterHairspaces(doc);
  rdr.cleandom.condenseWhitespace(doc);
  rdr.cleandom.unwrapSingleItemLists(doc);
  rdr.cleandom.filterTables(doc, 20);
  rdr.cleandom.filterLeaves(doc);
  rdr.cleandom.filterHRs(doc);
  rdr.cleandom.trimDoc(doc);
  rdr.cleandom.filterAttributes(doc);
};

rdr.cleandom.addNoReferrer = function(doc) {
  const anchors = doc.querySelectorAll('a');
  for(let anchor of anchors) {
    anchor.setAttribute('rel', 'noreferrer');
  }
};

rdr.cleandom.blockElements = ['blockquote', 'h1', 'h2', 'h3', 'h4',
  'h5', 'h6','p'];
rdr.cleandom.blockSelector = rdr.cleandom.blockElements.join(',');
rdr.cleandom.inlineInBlockElements = ['a'];
rdr.cleandom.inlineInBlockSelector =
  rdr.cleandom.inlineInBlockElements.join(',');

// Looks for cases such as <a><p>text</p></a> and transforms them into
// <p><a>text</a></p>.
rdr.cleandom.adjustBlockInlineElements = function(doc) {
  const blocks = doc.querySelectorAll(rdr.cleandom.blockSelector);
  for(let block of blocks) {
    const ancestor = block.closest(rdr.cleandom.inlineInBlockSelector);
    if(ancestor && ancestor.parentNode) {
      ancestor.parentNode.insertBefore(block, ancestor);
      for(let node = block.firstChild; node; node = block.firstChild) {
        ancestor.appendChild(node);
      }
      block.appendChild(ancestor);
    }
  }
};

rdr.cleandom.condenseWhitespace = function(doc) {
  const selector = 'code, pre, ruby, textarea, xmp';
  const it = doc.createNodeIterator(doc.documentElement, NodeFilter.SHOW_TEXT);
  for(let n = it.nextNode(); n; n = it.nextNode()) {
    const value = n.nodeValue;
    if(value.length > 3 && !n.parentNode.closest(selector)) {
      const condensed = value.replace(/\s{2,}/g, ' ');
      if(condensed.length !== value.length) {
        n.nodeValue = condensed;
      }
    }
  }
};

rdr.cleandom.unwrapScriptAnchors = function(doc) {
  const anchors = doc.querySelectorAll('a');
  for(let anchor of anchors) {
    const url = anchor.getAttribute('href');
    if(url && url.length > 11 && /^\s*javascript:/i.test(url)) {
      rdr.cleandom.unwrap(anchor);
    }
  }
};

rdr.cleandom.unwrapFormattingAnchors = function(doc) {
  const anchors = doc.querySelectorAll('a');
  for(let anchor of anchors) {
    if(!anchor.hasAttribute('href') && !anchor.hasAttribute('name')) {
      rdr.cleandom.unwrap(anchor);
    }
  }
};

rdr.cleandom.blacklistElements = [
  'APPLET', 'AUDIO', 'BASE', 'BASEFONT', 'BGSOUND', 'BUTTON', 'COMMAND',
  'DATALIST', 'DIALOG', 'EMBED', 'FIELDSET', 'FRAME', 'FRAMESET', 'HEAD',
  'IFRAME', 'INPUT', 'ISINDEX', 'LINK', 'MATH', 'META',
  'OBJECT', 'OUTPUT', 'OPTGROUP', 'OPTION', 'PARAM', 'PATH', 'PROGRESS',
  'SCRIPT', 'SELECT', 'SPACER', 'STYLE', 'SVG', 'TEXTAREA', 'TITLE',
  'VIDEO', 'XMP'
];
rdr.cleandom.blacklistSelector = rdr.cleandom.blacklistElements.join(',');

rdr.cleandom.filterBlacklistedElements = function(doc) {
  const de = doc.documentElement;
  const elements = doc.querySelectorAll(rdr.cleandom.blacklistSelector);
  for(let element of elements) {
    if(de.contains(element)) {
      element.remove();
    }
  }
};

rdr.cleandom.filterBreaks = function(doc) {
  const elements = doc.querySelectorAll('br + br');
  for(let element of elements) {
    element.remove();
  }
};

rdr.cleandom.filterComments = function(doc) {
  const rootNode = doc.documentElement;
  const it = doc.createNodeIterator(rootNode, NodeFilter.SHOW_COMMENT);
  for(let node = it.nextNode(); node; node = it.nextNode()) {
    node.remove();
  }
};

rdr.cleandom.filterAttributes = function(doc) {
  const elements = doc.getElementsByTagName('*');
  for(let element of elements) {
    let elementName = element.localName;
    let attributes = element.attributes;
    if(!attributes || !attributes.length) {
      continue;
    }

    if(elementName === 'source') {
      for(let i = attributes.length - 1; i > -1; i--) {
        let attributeName = attributes[i].name;
        if(attributeName !== 'type' && attributeName !== 'srcset' &&
          attributeName !== 'sizes' && attributeName !== 'media' &&
          attributeName !== 'src') {
          element.removeAttribute(attributeName);
        }
      }
    } else if(elementName === 'a') {
      for(let i = attributes.length - 1; i > -1; i--) {
        let attributeName = attributes[i].name;
        if(attributeName !== 'href' && attributeName !== 'name' &&
          attributeName !== 'title') {
          element.removeAttribute(attributeName);
        }
      }
    } else if(elementName === 'iframe') {
      for(let i = attributes.length - 1; i > -1; i--) {
        let attributeName = attributes[i].name;
        if(attributeName !== 'src') {
          element.removeAttribute(attributeName);
        }
      }
    } else if(elementName === 'img') {
      for(let i = attributes.length - 1; i > -1; i--) {
        let attributeName = attributes[i].name;
        if(attributeName !== 'src' && attributeName !== 'alt' &&
          attributeName !== 'srcset' && attributeName !== 'title') {
          element.removeAttribute(attributeName);
        }
      }
    } else {
      for(let i = attributes.length - 1; i > -1; i--) {
        element.removeAttribute(attributes[i].name);
      }
    }
  }
};

rdr.cleandom.hiddenSelector = [
  '[style*="display:none"]',
  '[style*="display: none"]',
  '[style*="visibility:hidden"]',
  '[style*="visibility: hidden"]',
  '[style*="opacity: 0.0"]',
  '[aria-hidden="true"]'
].join(',');

rdr.cleandom.filterHidden = function(doc) {
  const elements = doc.querySelectorAll(rdr.cleandom.hiddenSelector);
  const de = doc.documentElement;
  for(let element of elements) {
    if(element !== de && de.contains(element)) {
      rdr.cleandom.unwrap(element);
    }
  }
};

rdr.cleandom.hrSelector = [
  'hr + hr', // consecutive hrs
  'ul > hr', // hierarchy error
  'ol > hr' // hierarchy error
].join(',');

rdr.cleandom.filterHRs = function(doc) {
  const elements = doc.querySelectorAll(rdr.cleandom.hrSelector);
  for(let element of elements) {
    element.remove();
  }
};

rdr.cleandom.filterSmallImages = function(doc) {
  const images = doc.querySelectorAll('img');
  for(let img of images) {
    if(img.width < 2 || img.height < 2) {
      img.remove();
    }
  }
};

rdr.cleandom.filterSourcelessImages = function(doc) {
  const images = doc.querySelectorAll('img');
  for(let img of images) {
    if(!img.hasAttribute('src') && !img.hasAttribute('srcset')) {
      img.remove();
    }
  }
};

rdr.cleandom.filterInvalidAnchors = function(doc) {
  const anchors = doc.querySelectorAll('a');
  for(let anchor of anchors) {
    if(rdr.cleandom.isInvalidAnchor(anchor)) {
      anchor.remove();
    }
  }
};

rdr.cleandom.isInvalidAnchor = function(anchor) {
  console.assert(anchor);
  const href = anchor.getAttribute('href');
  return href && /^\s*https?:\/\/#/i.test(href);
};

rdr.cleandom.filterLeaves = function(doc) {
  const body = doc.body;
  if(!body) {
    return;
  }

  const de = doc.documentElement;
  const elements = body.querySelectorAll('*');
  for(let element of elements) {
    if(de.contains(element) && rdr.cleandom.isLeaf(element)) {
      element.remove();
    }
  }
};

rdr.cleandom.filterTables = function(doc, limit) {
  const tables = doc.querySelectorAll('table');
  for(let i = 0, len = tables.length; i < len; i++) {
    const table = tables[i];
    if(rdr.cleandom.isSingleColTable(table, limit)) {
      rdr.cleandom.unwrapSingleColTable(table);
    }
  }
};

rdr.cleandom.isSingleColTable = function(table, limit) {
  const rows = table.rows;
  const upper = Math.min(rows.length, limit);
  for(let i = 0; i < upper; i++) {
    if(!rdr.cleandom.isSingleColRow(rows[i])) {
      return false;
    }
  }
  return true;
};

rdr.cleandom.isSingleColRow = function(row) {
  const cells = row.cells;
  let nonEmptyCount = 0;
  for(let i = 0, len = cells.length; i < len; i++) {
    const cell = cells[i];
    if(!rdr.cleandom.isLeaf(cell)) {
      if(++nonEmptyCount > 1) {
        return false;
      }
    }
  }

  return true;
};

// TODO: only pad if adjacent to text
// TODO: can i use for..of over table.rows?
rdr.cleandom.unwrapSingleColTable = function(table) {
  const rows = table.rows;
  const numRows = rows.length;
  const parent = table.parentNode;
  const doc = table.ownerDocument;

  parent.insertBefore(doc.createTextNode(' '), table);
  for(let i = 0; i < numRows; i++) {
    const row = rows[i];
    // TODO: if the cell is a leaf, skip it and do not add a paragraph
    for(let k = 0, clen = row.cells.length; k < clen; k++) {
      const cell = row.cells[k];
      rdr.cleandom.insertChildrenBefore(cell, table);
    }

    parent.insertBefore(doc.createElement('p'), table);
  }

  parent.insertBefore(doc.createTextNode(' '), table);
  table.remove();
};

rdr.cleandom.unwrappableSelector = [
  'abbr', 'acronym', 'article', 'aside', 'center', 'colgroup', 'data',
  'details', 'div', 'footer', 'header', 'help', 'hgroup', 'ilayer', 'insert',
  'layer', 'legend', 'main', 'mark', 'marquee', 'meter', 'multicol', 'nobr',
  'section', 'span', 'tbody', 'tfoot', 'thead', 'form', 'label', 'big',
  'blink', 'font', 'plaintext', 'small', 'tt'
].join(',');

rdr.cleandom.filterUnwrappables = function(doc) {
  const elements = doc.querySelectorAll(rdr.cleandom.unwrappableSelector);
  for(let element of elements) {
    rdr.cleandom.unwrap(element);
  }
};

rdr.cleandom.leafExceptions = {
  'area': 1, 'audio': 1, 'base': 1, 'col': 1, 'command': 1, 'br': 1,
  'canvas': 1, 'col': 1, 'hr': 1, 'iframe': 1, 'img': 1, 'input': 1,
  'keygen': 1, 'meta': 1, 'nobr': 1, 'param': 1, 'path': 1, 'source': 1,
  'sbg': 1, 'textarea': 1, 'track': 1, 'video': 1, 'wbr': 1
};

rdr.cleandom.isLeaf = function(node) {
  switch(node.nodeType) {
    case Node.ELEMENT_NODE:
      if(node.localName in rdr.cleandom.leafExceptions) {
        return false;
      }

      for(let child = node.firstChild; child; child = child.nextSibling) {
        if(!rdr.cleandom.isLeaf(child)) {
          return false;
        }
      }
      break;
    case Node.TEXT_NODE:
      return !node.nodeValue.trim();
    case Node.COMMENT_NODE:
      return true;
    default:
      return false;
  }

  return true;
};

rdr.cleandom.filterHairspaces = function(doc) {
  const it = doc.createNodeIterator(doc.documentElement,
    NodeFilter.SHOW_TEXT);
  for(let node = it.nextNode(); node; node = it.nextNode()) {
    const value = node.nodeValue;
    const modifiedValue = value.replace(/&(hairsp|#8082|#x200a);/ig, ' ');
    if(modifiedValue !== value) {
      node.nodeValue = modifiedValue;
    }
  }
};

rdr.cleandom.filterNoscripts = function(doc) {
  const elements = doc.querySelectorAll('noscript');
  for(let element of elements) {
    rdr.cleandom.unwrap(element);
  }
};

rdr.cleandom.filterFrames = function(doc) {
  const frameset = doc.body;
  if(!frameset || frameset.localName !== 'frameset') {
    return;
  }

  const body = doc.createElement('body');
  const noframes = doc.querySelector('noframes');
  if(noframes) {
    for(let node = noframes.firstChild; node; node = noframes.firstChild) {
      body.appendChild(node);
    }
  } else {
    const error_node = doc.createTextNode('Unable to display framed document.');
    body.appendChild(error_node);
  }

  frameset.remove();
  doc.documentElement.appendChild(body);
};

rdr.cleandom.filterFigures = function(doc) {
  const figures = doc.querySelectorAll('FIGURE');
  for(let figure of figures) {
    if(figure.childElementCount === 1) {
      rdr.cleandom.unwrap(figure);
    }
  }
};

rdr.cleandom.trimDoc = function(doc) {
  const body = doc.body;
  if(!body) {
    return;
  }

  const firstChild = body.firstChild;
  if(firstChild) {
    rdr.cleandom.trimStep(firstChild, 'nextSibling');
    const lastChild = body.lastChild;
    if(lastChild && lastChild !== firstChild) {
      rdr.cleandom.trimStep(lastChild, 'previousSibling');
    }
  }
};

rdr.cleandom.trimmableElements = {
  'br': 1,
  'hr': 1,
  'nobr': 1
};

rdr.cleandom.canTrim = function(node) {
  return node && (node.localName in rdr.cleandom.trimmableElements ||
    (node.nodeType === Node.TEXT_NODE && !node.nodeValue.trim()));
};

rdr.cleandom.trimStep = function(startNode, propName) {
  let node = startNode;
  while(rdr.cleandom.canTrim(node)) {
    let sibling = node[propName];
    node.remove();
    node = sibling;
  }
};

rdr.cleandom.unwrap = function(element, referenceNode) {
  const target = referenceNode || element;
  const parent = target.parentNode;
  console.assert(parent);
  const doc = element.ownerDocument;
  const prevSibling = target.previousSibling;
  if(prevSibling && prevSibling.nodeType === Node.TEXT_NODE) {
    parent.insertBefore(doc.createTextNode(' '), target);
  }

  rdr.cleandom.insertChildrenBefore(element, target);

  const nextSibling = target.nextSibling;
  if(nextSibling && nextSibling.nodeType === Node.TEXT_NODE) {
    parent.insertBefore(doc.createTextNode(' '), target);
  }

  target.remove();
};

rdr.cleandom.insertChildrenBefore = function(parentNode, referenceNode) {
  const refParent = referenceNode.parentNode;
  for(let node = parentNode.firstChild; node; node = parentNode.firstChild) {
    refParent.insertBefore(node, referenceNode);
  }
};

rdr.cleandom.listSelector = 'ul, ol, dl';
rdr.cleandom.listItemNames = {'li': 1, 'dt': 1, 'dd': 1};

rdr.cleandom.unwrapSingleItemLists = function(doc) {
  const lists = doc.querySelectorAll(rdr.cleandom.listSelector);
  for(let list of lists) {
    rdr.cleandom.unwrapSingleItemList(doc, list);
  }
};

rdr.cleandom.unwrapSingleItemList = function(doc, list) {
  const item = list.firstElementChild;
  if(!item) {
    return;
  }

  if(item.nextElementSibling) {
    return;
  }

  if(!(item.localName in rdr.cleandom.listItemNames)) {
    return;
  }

  if(!item.firstChild) {
    if(rdr.cleandom.isText(list.previousSibling) &&
      rdr.cleandom.isText(list.nextSibling)) {
      list.parentNode.replaceChild(doc.createTextNode(' '), list);
    } else {
      list.remove();
    }

    return;
  }

  if(rdr.cleandom.isText(list.previousSibling) &&
    rdr.cleandom.isText(item.firstChild)) {
    list.parentNode.insertBefore(doc.createTextNode(' '), list);
  }

  rdr.cleandom.insertChildrenBefore(item, list);

  if(rdr.cleandom.isText(list.nextSibling) &&
    rdr.cleandom.isText(list.previousSibling)) {
    list.parentNode.insertBefore(doc.createTextNode(' '), list);
  }

  list.remove();
};

rdr.cleandom.isText = function(node) {
  return node && node.nodeType === Node.TEXT_NODE;
};
