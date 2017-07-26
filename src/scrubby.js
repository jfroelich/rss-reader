// See license.md
'use strict';

const scrubby = {};

scrubby.scrub = function(documentObject) {
  scrubby.filterComments(documentObject);
  scrubby.filterFrames(documentObject);
  scrubby.filterNoscripts(documentObject);
  scrubby.filterScriptElements(documentObject);
  scrubby.filterBlacklist(documentObject);
  scrubby.filterHidden(documentObject);
  scrubby.adjustBlockInlines(documentObject);
  scrubby.filterBRs(documentObject);
  scrubby.filterAnchors(documentObject);
  scrubby.filterFormattingAnchors(documentObject);
  scrubby.filterSmallImages(documentObject, 2);
  scrubby.filterSourcelessImages(documentObject);
  scrubby.filterUnwrappables(documentObject);
  scrubby.filterFigures(documentObject);
  scrubby.filterHairspaces(documentObject);
  scrubby.condenseNodeWhitespace(documentObject);
  scrubby.filterSingleItemLists(documentObject);
  scrubby.filterTables(documentObject, 20);
  scrubby.filterLeaves(documentObject);
  scrubby.filterHRs(documentObject);
  scrubby.trimDocument(documentObject);
  scrubby.filterAttributes(documentObject);
};

scrubby.filterScriptElements = function(documentObject) {
  const elements = documentObject.querySelectorAll('script');
  for(let element of elements) {
    element.remove();
  }
};

scrubby.addNoReferrer = function(documentObject) {
  const anchors = documentObject.querySelectorAll('a');
  for(let anchor of anchors) {
    anchor.setAttribute('rel', 'noreferrer');
  }
};

// Looks for cases such as <a><p>text</p></a> and transforms them into
// <p><a>text</a></p>.
scrubby.adjustBlockInlines = function(documentObject) {
  const blockSelector = 'blockquote, h1, h2, h3, h4, h5, h6, p';
  const inlineSelector = 'a';
  const blocks = documentObject.querySelectorAll(blockSelector);
  for(let block of blocks) {
    const ancestor = block.closest(inlineSelector);
    if(ancestor && ancestor.parentNode) {
      ancestor.parentNode.insertBefore(block, ancestor);
      for(let node = block.firstChild; node; node = block.firstChild) {
        ancestor.appendChild(node);
      }
      block.appendChild(ancestor);
    }
  }
};

scrubby.condenseNodeWhitespace = function(documentObject) {
  const iterator = documentObject.createNodeIterator(
    documentObject.documentElement, NodeFilter.SHOW_TEXT);
  for(let node = iterator.nextNode(); node; node = iterator.nextNode()) {
    const value = node.nodeValue;
    if(value.length > 3 && !scrubby.isSensitiveDescendant(node)) {
      const condensed = scrubby.condenseWhitespace(value);
      if(condensed.length !== value.length) {
        node.nodeValue = condensed;
      }
    }
  }
};

// Find any sequence of 2 or more whitespace characters and replace with a
// single space
scrubby.condenseWhitespace = function(string) {
  return string.replace(/\s{2,}/g, ' ');
};

// Returns true if the node lies within a whitespace sensitive element
scrubby.isSensitiveDescendant = function(node) {
  return node.parentNode.closest('code, pre, ruby, textarea, xmp');
};

scrubby.filterAnchors = function(documentObject) {
  const anchors = documentObject.querySelectorAll('a');
  for(let anchor of anchors) {
    if(scrubby.isScriptURL(anchor.getAttribute('href'))) {
      scrubby.unwrap(anchor);
    }
  }
};

scrubby.isScriptURL = function(urlString) {
  return urlString && urlString.length > 11 &&
    /^\s*javascript:/i.test(urlString);
};

scrubby.filterFormattingAnchors = function(documentObject) {
  const anchors = documentObject.querySelectorAll('a');
  for(let anchor of anchors) {
    if(!anchor.hasAttribute('href') && !anchor.hasAttribute('name')) {
      scrubby.unwrap(anchor);
    }
  }
};

// TODO: accept options parameter for custom blacklist that defaults to
// built in list
scrubby.filterBlacklist = function(documentObject) {
  const blacklist = [
    'applet', 'audio', 'base', 'basefont', 'bgsound', 'button', 'command',
    'datalist', 'dialog', 'embed', 'fieldset', 'frame', 'frameset', 'head',
    'iframe', 'input', 'isindex', 'link', 'math', 'meta',
    'object', 'output', 'optgroup', 'option', 'param', 'path', 'progress',
    'select', 'spacer', 'style', 'svg', 'textarea', 'title',
    'video', 'xmp'
  ];

  const blacklistSelector = blacklist.join(',');
  const documentElement = documentObject.documentElement;
  const elements = documentObject.querySelectorAll(blacklistSelector);
  for(let element of elements) {
    if(documentElement.contains(element)) {
      element.remove();
    }
  }
};

scrubby.filterBRs = function(documentObject) {
  const elements = documentObject.querySelectorAll('br + br');
  for(let element of elements) {
    element.remove();
  }
};

scrubby.filterComments = function(documentObject) {
  const documentElement = documentObject.documentElement;
  const iterator = documentObject.createNodeIterator(documentElement,
    NodeFilter.SHOW_COMMENT);
  for(let node = iterator.nextNode(); node; node = iterator.nextNode()) {
    node.remove();
  }
};

scrubby.filterFrames = function(documentObject) {
  const frameset = documentObject.body;
  if(!frameset || frameset.localName !== 'frameset') {
    return;
  }

  const body = documentObject.createElement('body');
  const noframes = documentObject.querySelector('noframes');
  if(noframes) {
    for(let node = noframes.firstChild; node; node = noframes.firstChild) {
      body.appendChild(node);
    }
  } else {
    const error = documentObject.createTextNode('Unable to display framed document.');
    body.appendChild(error);
  }

  frameset.remove();
  documentObject.documentElement.appendChild(body);
};

scrubby.filterAttributes = function(documentObject) {
  const elements = documentObject.getElementsByTagName('*');
  for(let element of elements) {
    let localName = element.localName;
    let attributes = element.attributes;
    if(!attributes || !attributes.length) {
      continue;
    }

    if(localName === 'source') {
      for(let i = attributes.length - 1; i > -1; i--) {
        let attributeName = attributes[i].name;
        if(attributeName !== 'type' && attributeName !== 'srcset' &&
          attributeName !== 'sizes' && attributeName !== 'media' &&
          attributeName !== 'src') {
          element.removeAttribute(attributeName);
        }
      }
    } else if(localName === 'a') {
      for(let i = attributes.length - 1; i > -1; i--) {
        let attributeName = attributes[i].name;
        if(attributeName !== 'href' && attributeName !== 'name' &&
          attributeName !== 'title') {
          element.removeAttribute(attributeName);
        }
      }
    } else if(localName === 'iframe') {
      for(let i = attributes.length - 1; i > -1; i--) {
        let attributeName = attributes[i].name;
        if(attributeName !== 'src') {
          element.removeAttribute(attributeName);
        }
      }
    } else if(localName === 'img') {
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

scrubby.filterHidden = function(documentObject) {
  const selector = [
    '[style*="display:none"]',
    '[style*="visibility:hidden"]',
    '[style*="opacity:0.0"]',
    '[aria-hidden="true"]'
  ].join(',');

  const elements = documentObject.querySelectorAll(selector);
  const documentElement = documentObject.documentElement;
  for(let element of elements) {
    if(element !== documentElement && documentElement.contains(element)) {
      scrubby.unwrap(element);
    }
  }
};

scrubby.filterHRs = function(documentObject) {
  const elements = documentObject.querySelectorAll('hr + hr, ul > hr, ol > hr');
  for(let element of elements) {
    element.remove();
  }
};

scrubby.filterSmallImages = function(documentObject, minDimValue) {
  const images = documentObject.querySelectorAll('img');
  for(let image of images) {
    if(image.width < minDimValue || image.height < minDimValue) {
      image.remove();
    }
  }
};

scrubby.filterSourcelessImages = function(documentObject) {
  const images = documentObject.querySelectorAll('img');
  for(let image of images) {
    if(!image.hasAttribute('src') && !image.hasAttribute('srcset')) {
      image.remove();
    }
  }
};

scrubby.filterInvalidAnchors = function(documentObject) {
  const anchors = documentObject.querySelectorAll('a');
  for(let anchor of anchors) {
    if(scrubby.isInvalidAnchor(anchor)) {
      anchor.remove();
    }
  }
};

scrubby.isInvalidAnchor = function(anchor) {
  const href = anchor.getAttribute('href');
  return href && /^\s*https?:\/\/#/i.test(href);
};

scrubby.filterLeaves = function(documentObject) {
  if(!documentObject.body) {
    return;
  }

  const documentElement = documentObject.documentElement;
  const elements = documentObject.body.querySelectorAll('*');
  for(let element of elements) {
    if(documentElement.contains(element) && scrubby.isLeaf(element)) {
      element.remove();
    }
  }
};

scrubby.isLeafException = function(element) {
  const exceptions = {
    'area': 0, 'audio': 0, 'base': 0, 'col': 0, 'command': 0, 'br': 0,
    'canvas': 0, 'col': 0, 'hr': 0, 'iframe': 0, 'img': 0, 'input': 0,
    'keygen': 0, 'meta': 0, 'nobr': 0, 'param': 0, 'path': 0, 'source': 0,
    'sbg': 0, 'textarea': 0, 'track': 0, 'video': 0, 'wbr': 0
  };

  return element.localName in exceptions;
};

scrubby.isLeaf = function(node) {
  switch(node.nodeType) {
    case Node.ELEMENT_NODE:
      if(scrubby.isLeafException(node)) {
        return false;
      }
      for(let child = node.firstChild; child; child = child.nextSibling) {
        if(!scrubby.isLeaf(child)) {
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

scrubby.filterTables = function(documentObject, limit) {
  const tables = documentObject.querySelectorAll('table');
  for(let table of tables) {
    if(scrubby.isSingleColumnTable(table, limit)) {
      scrubby.unwrapSingleColumnTable(table);
    }
  }
};

scrubby.isSingleColumnTable = function(table, limit) {
  const rows = table.rows;
  const upper = Math.min(rows.length, limit);
  for(let i = 0; i < upper; i++) {
    if(!scrubby.isSingleColumnRow(rows[i])) {
      return false;
    }
  }
  return true;
};

scrubby.isSingleColumnRow = function(row) {
  const cells = row.cells;
  let numNonEmpty = 0;
  for(let i = 0, len = cells.length; i < len; i++) {
    if(!scrubby.isLeaf(cells[i])) {
      if(++numNonEmpty > 1) {
        return false;
      }
    }
  }

  return true;
};

scrubby.unwrapSingleColumnTable = function(table) {
  const rows = table.rows;
  const numRows = rows.length;
  const parent = table.parentNode;
  const documentObject = table.ownerDocument;

  parent.insertBefore(documentObject.createTextNode(' '), table);
  for(let i = 0; i < numRows; i++) {
    const row = rows[i];
    // TODO: if the cell is a leaf, skip iterator and do not add a paragraph
    for(let k = 0, clen = row.cells.length; k < clen; k++) {
      const cell = row.cells[k];
      scrubby.insertChildrenBefore(cell, table);
    }

    parent.insertBefore(documentObject.createElement('p'), table);
  }

  parent.insertBefore(documentObject.createTextNode(' '), table);
  table.remove();
};

scrubby.filterUnwrappables = function(documentObject) {
  const selector = [
    'abbr', 'acronym', 'article', 'aside', 'center', 'colgroup', 'data',
    'details', 'div', 'footer', 'header', 'help', 'hgroup', 'ilayer',
    'insert', 'layer', 'legend', 'main', 'mark', 'marquee', 'meter',
    'multicol', 'nobr', 'section', 'span', 'tbody', 'tfoot', 'thead', 'form',
    'label', 'big', 'blink', 'font', 'plaintext', 'small', 'tt'
  ].join(',');
  const elements = documentObject.querySelectorAll(selector);
  for(let element of elements) {
    scrubby.unwrap(element);
  }
};

scrubby.filterHairspaces = function(documentObject) {
  const iterator = documentObject.createNodeIterator(
    documentObject.documentElement, NodeFilter.SHOW_TEXT);
  for(let node = iterator.nextNode(); node; node = iterator.nextNode()) {
    const value = node.nodeValue;
    const modified = value.replace(/&(hairsp|#8082|#x200a);/ig, ' ');
    if(modified.length !== value.length) {
      node.nodeValue = modified;
    }
  }
};

scrubby.filterNoscripts = function(documentObject) {
  const elements = documentObject.querySelectorAll('noscript');
  for(let element of elements) {
    scrubby.unwrap(element);
  }
};

scrubby.filterFigures = function(documentObject) {
  const figures = documentObject.querySelectorAll('figure');
  for(let figure of figures) {
    if(figure.childElementCount === 1) {
      scrubby.unwrap(figure);
    }
  }
};

scrubby.trimDocument = function(documentObject) {
  if(!documentObject.body) {
    return;
  }

  const firstChild = documentObject.body.firstChild;
  if(firstChild) {
    scrubby.trimWalk(firstChild, 'nextSibling');
    const lastChild = documentObject.body.lastChild;
    if(lastChild && lastChild !== firstChild) {
      scrubby.trimWalk(lastChild, 'previousSibling');
    }
  }
};

scrubby.canTrim = function(node) {
  const elements = ['br', 'hr', 'nobr'];
  return node && (elements.includes(node.localName) ||
    (node.nodeType === Node.TEXT_NODE && !node.nodeValue.trim()));
};

scrubby.trimWalk = function(startNode, edge) {
  let node = startNode;
  while(scrubby.canTrim(node)) {
    let sibling = node[edge];
    node.remove();
    node = sibling;
  }
};

scrubby.unwrap = function(element, referenceNode) {
  const target = referenceNode || element;
  const parent = target.parentNode;

  if(!parent) {
    throw new TypeError();
  }

  const documentObject = element.ownerDocument;
  const previousSibling = target.previousSibling;
  if(previousSibling && previousSibling.nodeType === Node.TEXT_NODE) {
    parent.insertBefore(documentObject.createTextNode(' '), target);
  }

  scrubby.insertChildrenBefore(element, target);

  const nextSibling = target.nextSibling;
  if(nextSibling && nextSibling.nodeType === Node.TEXT_NODE) {
    parent.insertBefore(documentObject.createTextNode(' '), target);
  }

  target.remove();
};

scrubby.insertChildrenBefore = function(parentNode, referenceNode) {
  const refParent = referenceNode.parentNode;
  for(let node = parentNode.firstChild; node; node = parentNode.firstChild) {
    refParent.insertBefore(node, referenceNode);
  }
};

scrubby.filterSingleItemLists = function(documentObject) {
  const lists = documentObject.querySelectorAll('ul, ol, dl');
  for(let list of lists) {
    scrubby.filterSingleItemList(documentObject, list);
  }
};

// Unwraps single item or empty list elements
scrubby.filterSingleItemList = function(documentObject, list) {
  const listParent = list.parentNode;
  if(!listParent)
    return;

  const item = list.firstElementChild;

  // If the list has no child elements then move its child nodes out of the
  // list and remove iterator
  if(!item) {
    // If iterator is just <list>...<item/>...<list> then remove
    if(!list.firstChild) {
      list.remove();
      return;
    }
    // The list has no child elements, but the list has one or more child
    // nodes. Move the nodes to before the list. Add padding if needed.
    if(scrubby.isTextNode(list.previousSibling))
      listParent.insertBefore(documentObject.createTextNode(' '), list);
    for(let node = list.firstChild; node; node = list.firstChild) {
      listParent.insertBefore(node, list);
    }
    if(scrubby.isTextNode(list.nextSibling))
      listParent.insertBefore(documentObject.createTextNode(' '), list);
    list.remove();
    return;
  }

  // If the list has more than one child element then leave the list as is
  if(item.nextElementSibling)
    return;
  // If the list's only child element isn't one of the correct types, ignore iterator
  const list_item_names = {'li': 0, 'dt': 0, 'dd': 0};
  if(!(item.localName in list_item_names))
    return;

  // If the list has one child element of the correct type, and that child
  // element has no inner content, then remove the list. This will also remove
  // any non-element nodes within the list outside of the child element.
  if(!item.firstChild) {
    // If removing the list, avoid the possible merging of adjacent text nodes
    if(scrubby.isTextNode(list.previousSibling) &&
      scrubby.isTextNode(list.nextSibling))
      listParent.replaceChild(documentObject.createTextNode(' '), list);
    else
      list.remove();
    return;
  }

  // The list has one child element with one or more child nodes. Move the
  // child nodes to before the list and then remove iterator. Add padding if needed.
  if(scrubby.isTextNode(list.previousSibling) &&
    scrubby.isTextNode(item.firstChild)) {
    listParent.insertBefore(documentObject.createTextNode(' '), list);
  }

  scrubby.insertChildrenBefore(item, list);

  if(scrubby.isTextNode(list.nextSibling) &&
    scrubby.isTextNode(list.previousSibling)) {
    listParent.insertBefore(documentObject.createTextNode(' '), list);
  }

  list.remove();
};

scrubby.isTextNode = function(node) {
  return node && node.nodeType === Node.TEXT_NODE;
};
