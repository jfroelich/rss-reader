// See license.md

'use strict';

const DOMScrub = {};

DOMScrub.cleanDoc = function(doc) {
  DOMScrub.filterComments(doc);
  DOMScrub.filterFrames(doc);
  DOMScrub.filterNoscripts(doc);
  DOMScrub.filterBlacklistedElements(doc);
  DOMScrub.filterHidden(doc);
  DOMScrub.adjustBlockInlineElements(doc);
  DOMScrub.filterBreaks(doc);
  DOMScrub.unwrapScriptAnchors(doc);
  DOMScrub.unwrapFormattingAnchors(doc);
  DOMScrub.filterSmallImages(doc);
  DOMScrub.filterSourcelessImages(doc);
  DOMScrub.filterUnwrappables(doc);
  DOMScrub.filterFigures(doc);
  DOMScrub.filterHairspaces(doc);
  DOMScrub.condenseWhitespace(doc);
  DOMScrub.unwrapSingleItemLists(doc);
  DOMScrub.filterTables(doc, 20);
  DOMScrub.filterLeaves(doc);
  DOMScrub.filterHRs(doc);
  DOMScrub.trimDoc(doc);
  DOMScrub.filterAttributes(doc);
};

DOMScrub.addNoReferrer = function(doc) {
  const anchors = doc.querySelectorAll('a');
  for(let anchor of anchors) {
    anchor.setAttribute('rel', 'noreferrer');
  }
};

// Looks for cases such as <a><p>text</p></a> and transforms them into
// <p><a>text</a></p>.
DOMScrub.adjustBlockInlineElements = function(doc) {
  const blockSelector = 'blockquote, h1, h2, h3, h4, h5, h6, p';
  const inlineInBlockSelector = 'a';
  const blocks = doc.querySelectorAll(blockSelector);
  for(let block of blocks) {
    const ancestor = block.closest(inlineInBlockSelector);
    if(ancestor && ancestor.parentNode) {
      ancestor.parentNode.insertBefore(block, ancestor);
      for(let node = block.firstChild; node; node = block.firstChild) {
        ancestor.appendChild(node);
      }
      block.appendChild(ancestor);
    }
  }
};

DOMScrub.condenseWhitespace = function(doc) {
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

DOMScrub.unwrapScriptAnchors = function(doc) {
  const anchors = doc.querySelectorAll('a');
  for(let anchor of anchors) {
    const url = anchor.getAttribute('href');
    if(url && url.length > 11 && /^\s*javascript:/i.test(url)) {
      DOMScrub.unwrap(anchor);
    }
  }
};

DOMScrub.unwrapFormattingAnchors = function(doc) {
  const anchors = doc.querySelectorAll('a');
  for(let anchor of anchors) {
    if(!anchor.hasAttribute('href') && !anchor.hasAttribute('name')) {
      DOMScrub.unwrap(anchor);
    }
  }
};

DOMScrub.blacklistElements = [
  'APPLET', 'AUDIO', 'BASE', 'BASEFONT', 'BGSOUND', 'BUTTON', 'COMMAND',
  'DATALIST', 'DIALOG', 'EMBED', 'FIELDSET', 'FRAME', 'FRAMESET', 'HEAD',
  'IFRAME', 'INPUT', 'ISINDEX', 'LINK', 'MATH', 'META',
  'OBJECT', 'OUTPUT', 'OPTGROUP', 'OPTION', 'PARAM', 'PATH', 'PROGRESS',
  'SCRIPT', 'SELECT', 'SPACER', 'STYLE', 'SVG', 'TEXTAREA', 'TITLE',
  'VIDEO', 'XMP'
];
DOMScrub.blacklistSelector = DOMScrub.blacklistElements.join(',');

DOMScrub.filterBlacklistedElements = function(doc) {
  const de = doc.documentElement;
  const elements = doc.querySelectorAll(DOMScrub.blacklistSelector);
  for(let element of elements) {
    if(de.contains(element)) {
      element.remove();
    }
  }
};

DOMScrub.filterBreaks = function(doc) {
  const elements = doc.querySelectorAll('br + br');
  for(let element of elements) {
    element.remove();
  }
};

DOMScrub.filterComments = function(doc) {
  const rootNode = doc.documentElement;
  const it = doc.createNodeIterator(rootNode, NodeFilter.SHOW_COMMENT);
  for(let node = it.nextNode(); node; node = it.nextNode()) {
    node.remove();
  }
};

DOMScrub.filterAttributes = function(doc) {
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

DOMScrub.hiddenSelector = [
  '[style*="display:none"]',
  '[style*="display: none"]',
  '[style*="visibility:hidden"]',
  '[style*="visibility: hidden"]',
  '[style*="opacity: 0.0"]',
  '[aria-hidden="true"]'
].join(',');

DOMScrub.filterHidden = function(doc) {
  const elements = doc.querySelectorAll(DOMScrub.hiddenSelector);
  const de = doc.documentElement;
  for(let element of elements) {
    if(element !== de && de.contains(element)) {
      DOMScrub.unwrap(element);
    }
  }
};

DOMScrub.hrSelector = [
  'hr + hr', // consecutive hrs
  'ul > hr', // hierarchy error
  'ol > hr' // hierarchy error
].join(',');

DOMScrub.filterHRs = function(doc) {
  const elements = doc.querySelectorAll(DOMScrub.hrSelector);
  for(let element of elements) {
    element.remove();
  }
};

DOMScrub.filterSmallImages = function(doc) {
  const images = doc.querySelectorAll('img');
  for(let img of images) {
    if(img.width < 2 || img.height < 2) {
      img.remove();
    }
  }
};

DOMScrub.filterSourcelessImages = function(doc) {
  const images = doc.querySelectorAll('img');
  for(let img of images) {
    if(!img.hasAttribute('src') && !img.hasAttribute('srcset')) {
      img.remove();
    }
  }
};

DOMScrub.filterInvalidAnchors = function(doc) {
  const anchors = doc.querySelectorAll('a');
  for(let anchor of anchors) {
    if(DOMScrub.isInvalidAnchor(anchor)) {
      anchor.remove();
    }
  }
};

DOMScrub.isInvalidAnchor = function(anchor) {
  const href = anchor.getAttribute('href');
  return href && /^\s*https?:\/\/#/i.test(href);
};

DOMScrub.filterLeaves = function(doc) {
  const body = doc.body;
  if(!body) {
    return;
  }

  const de = doc.documentElement;
  const elements = body.querySelectorAll('*');
  for(let element of elements) {
    if(de.contains(element) && DOMScrub.isLeaf(element)) {
      element.remove();
    }
  }
};

DOMScrub.filterTables = function(doc, limit) {
  const tables = doc.querySelectorAll('table');
  for(let i = 0, len = tables.length; i < len; i++) {
    const table = tables[i];
    if(DOMScrub.isSingleColTable(table, limit)) {
      DOMScrub.unwrapSingleColTable(table);
    }
  }
};

DOMScrub.isSingleColTable = function(table, limit) {
  const rows = table.rows;
  const upper = Math.min(rows.length, limit);
  for(let i = 0; i < upper; i++) {
    if(!DOMScrub.isSingleColRow(rows[i])) {
      return false;
    }
  }
  return true;
};

DOMScrub.isSingleColRow = function(row) {
  const cells = row.cells;
  let nonEmptyCount = 0;
  for(let i = 0, len = cells.length; i < len; i++) {
    const cell = cells[i];
    if(!DOMScrub.isLeaf(cell)) {
      if(++nonEmptyCount > 1) {
        return false;
      }
    }
  }

  return true;
};

// TODO: only pad if adjacent to text
// TODO: can i use for..of over table.rows?
DOMScrub.unwrapSingleColTable = function(table) {
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
      DOMScrub.insertChildrenBefore(cell, table);
    }

    parent.insertBefore(doc.createElement('p'), table);
  }

  parent.insertBefore(doc.createTextNode(' '), table);
  table.remove();
};

DOMScrub.unwrappableSelector = [
  'abbr', 'acronym', 'article', 'aside', 'center', 'colgroup', 'data',
  'details', 'div', 'footer', 'header', 'help', 'hgroup', 'ilayer', 'insert',
  'layer', 'legend', 'main', 'mark', 'marquee', 'meter', 'multicol', 'nobr',
  'section', 'span', 'tbody', 'tfoot', 'thead', 'form', 'label', 'big',
  'blink', 'font', 'plaintext', 'small', 'tt'
].join(',');

DOMScrub.filterUnwrappables = function(doc) {
  const elements = doc.querySelectorAll(DOMScrub.unwrappableSelector);
  for(let element of elements) {
    DOMScrub.unwrap(element);
  }
};

DOMScrub.leafExceptions = {
  'area': 1, 'audio': 1, 'base': 1, 'col': 1, 'command': 1, 'br': 1,
  'canvas': 1, 'col': 1, 'hr': 1, 'iframe': 1, 'img': 1, 'input': 1,
  'keygen': 1, 'meta': 1, 'nobr': 1, 'param': 1, 'path': 1, 'source': 1,
  'sbg': 1, 'textarea': 1, 'track': 1, 'video': 1, 'wbr': 1
};

DOMScrub.isLeaf = function(node) {
  switch(node.nodeType) {
    case Node.ELEMENT_NODE:
      if(node.localName in DOMScrub.leafExceptions) {
        return false;
      }

      for(let child = node.firstChild; child; child = child.nextSibling) {
        if(!DOMScrub.isLeaf(child)) {
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

DOMScrub.filterHairspaces = function(doc) {
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

DOMScrub.filterNoscripts = function(doc) {
  const elements = doc.querySelectorAll('noscript');
  for(let element of elements) {
    DOMScrub.unwrap(element);
  }
};

DOMScrub.filterFrames = function(doc) {
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

DOMScrub.filterFigures = function(doc) {
  const figures = doc.querySelectorAll('FIGURE');
  for(let figure of figures) {
    if(figure.childElementCount === 1) {
      DOMScrub.unwrap(figure);
    }
  }
};

DOMScrub.trimDoc = function(doc) {
  const body = doc.body;
  if(!body) {
    return;
  }

  const firstChild = body.firstChild;
  if(firstChild) {
    DOMScrub.trimStep(firstChild, 'nextSibling');
    const lastChild = body.lastChild;
    if(lastChild && lastChild !== firstChild) {
      DOMScrub.trimStep(lastChild, 'previousSibling');
    }
  }
};

DOMScrub.trimmableElements = {
  'br': 1,
  'hr': 1,
  'nobr': 1
};

DOMScrub.canTrim = function(node) {
  return node && (node.localName in DOMScrub.trimmableElements ||
    (node.nodeType === Node.TEXT_NODE && !node.nodeValue.trim()));
};

DOMScrub.trimStep = function(startNode, propName) {
  let node = startNode;
  while(DOMScrub.canTrim(node)) {
    let sibling = node[propName];
    node.remove();
    node = sibling;
  }
};

DOMScrub.unwrap = function(element, referenceNode) {
  const target = referenceNode || element;
  const parent = target.parentNode;

  if(!parent) {
    throw new Error('Cannot unwrap without a parent');
  }

  const doc = element.ownerDocument;
  const prevSibling = target.previousSibling;
  if(prevSibling && prevSibling.nodeType === Node.TEXT_NODE) {
    parent.insertBefore(doc.createTextNode(' '), target);
  }

  DOMScrub.insertChildrenBefore(element, target);

  const nextSibling = target.nextSibling;
  if(nextSibling && nextSibling.nodeType === Node.TEXT_NODE) {
    parent.insertBefore(doc.createTextNode(' '), target);
  }

  target.remove();
};

DOMScrub.insertChildrenBefore = function(parentNode, referenceNode) {
  const refParent = referenceNode.parentNode;
  for(let node = parentNode.firstChild; node; node = parentNode.firstChild) {
    refParent.insertBefore(node, referenceNode);
  }
};

DOMScrub.listSelector = 'ul, ol, dl';
DOMScrub.listItemNames = {'li': 1, 'dt': 1, 'dd': 1};
DOMScrub.unwrapSingleItemLists = function(doc) {
  const lists = doc.querySelectorAll(DOMScrub.listSelector);
  for(let list of lists) {
    DOMScrub.unwrapSingleItemList(doc, list);
  }
};

DOMScrub.unwrapSingleItemList = function(doc, list) {
  const item = list.firstElementChild;
  if(!item) {
    return;
  }

  if(item.nextElementSibling) {
    return;
  }

  if(!(item.localName in DOMScrub.listItemNames)) {
    return;
  }

  if(!item.firstChild) {
    if(DOMScrub.isText(list.previousSibling) &&
      DOMScrub.isText(list.nextSibling)) {
      list.parentNode.replaceChild(doc.createTextNode(' '), list);
    } else {
      list.remove();
    }

    return;
  }

  if(DOMScrub.isText(list.previousSibling) &&
    DOMScrub.isText(item.firstChild)) {
    list.parentNode.insertBefore(doc.createTextNode(' '), list);
  }

  DOMScrub.insertChildrenBefore(item, list);

  if(DOMScrub.isText(list.nextSibling) &&
    DOMScrub.isText(list.previousSibling)) {
    list.parentNode.insertBefore(doc.createTextNode(' '), list);
  }

  list.remove();
};

DOMScrub.isText = function(node) {
  return node && node.nodeType === Node.TEXT_NODE;
};
