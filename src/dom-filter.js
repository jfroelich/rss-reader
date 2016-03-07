// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

var DOMFilter = {};

// Applies a series of transformations to a document in preparation for
// appending it to the UI.
// NOTE: eventually i will want something that can do pre-storage cleanup. That
// function will probably look very similar to this one. In fact it may be
// the same function. However, I an naming this 'for-view' because I want to be
// clear that I am unclear about how it will turn out currently.
// TODO: properly handle noembed
// TODO: support audio/video
DOMFilter.prepareDocumentForView = function(document) {
  'use strict';

  DOMFilter.filterCommentNodes(document);
  DOMFilter.filterFrameElements(document);

  DOMFilter.filterScriptElements(document);
  DOMFilter.filterNoScriptElements(document);

  DOMFilter.filterJavascriptAnchors(document);
  DOMFilter.filterBlacklistedElements(document);
  DOMFilter.filterHiddenElements(document);
  // DOMFilter.filterBreakruleElements(document);

  // Filter boilerplate using Calamine
  const calamine = new Calamine();
  calamine.analyze(document);
  calamine.prune();

  DOMFilter.filterSourcelessImages(document);
  DOMFilter.filterTracerImages(document);
  DOMFilter.normalizeWhitespace(document);

  DOMFilter.filterInlineElements(document);

  DOMFilter.condenseNodeValues(document);
  DOMFilter.filterNominalAnchors(document);
  DOMFilter.trimTextNodes(document);
  DOMFilter.filterEmptyTextNodes(document);
  DOMFilter.filterLeafElements(document);
  DOMFilter.filterSingleItemLists(document);
  DOMFilter.filterSingleCellTables(document);
  DOMFilter.filterSingleColumnTables(document);
  DOMFilter.trimDocument(document);
  DOMFilter.filterAttributes(document);
};

DOMFilter.findImageCaption = function(image) {
  'use strict';
  const figure = image.closest('figure');
  return figure ? figure.querySelector('figcaption') : null;
};

// Removes all comment nodes from the document
DOMFilter.filterCommentNodes = function(document) {
  'use strict';
  const it = document.createNodeIterator(document.documentElement,
    NodeFilter.SHOW_COMMENT);
  for(let node = it.nextNode(); node; node = it.nextNode()) {
    node.remove();
  }
};

DOMFilter.BLACKLIST = [
  'applet',
  'object',
  'embed',
  'param',
  'video',
  'audio',
  'bgsound',
  'head',
  'meta',
  'title',
  'datalist',
  'dialog',
  'fieldset',
  'isindex',
  'math',
  'output',
  'optgroup',
  'progress',
  'spacer',
  'xmp',
  'style',
  'link',
  'basefont',
  'select',
  'option',
  'textarea',
  'input',
  'button',
  'command'
];

DOMFilter.filterBlacklistedElements = function(document) {
  'use strict';
/*
  // TODO: test whether this actually improves performance. The idea here is
  // that using adoptNode let's us skip later adopt calls.
  const selector = DOMFilter.BLACKLIST.join(',');
  const target = document.implementation.createHTMLDocument();
  const elements = document.querySelectorAll(selector);
  const numElements = elements.length;
  for(let i = 0, element; i < numElements; i++) {
    element = elements[i];
    if(element.ownerDocument === document) {
      target.adoptNode(element);
    }
  }
*/

  // NOTE: I am getting almost identical performance ...

  const selector = DOMFilter.BLACKLIST.join(',');
  const elements = document.querySelectorAll(selector);
  const numElements = elements.length;
  for(let i = 0; i < numElements; i++) {
    elements[i].remove();
  }
};

// Replaces <br> elements within a document with <p>
// TODO: this function needs some substantial improvement. there are several
// problems with its current approach, such as what happens when inserting
// a paragraph element within an inline element.
// error case: http://paulgraham.com/procrastination.html
DOMFilter.filterBreakruleElements = function(document) {
  'use strict';
  const elements = document.querySelectorAll('br');
  const numElements = elements.length;
  for(let i = 0, element, parent, p; i < numElements; i++) {
    element = elements[i];
    parent = element.parentNode;
    p = document.createElement('p');
    parent.replaceChild(p, element);
  }
};

// Removes certain attributes from all elements in the document
DOMFilter.filterAttributes = function(document) {
  'use strict';
  const elements = document.getElementsByTagName('*');
  const numElements = elements.length;

  // Iterate in reverse to avoid issues with mutating a live
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
};

// Filters frame, noframes, frameset, and iframe elements
DOMFilter.filterFrameElements = function(document) {
  'use strict';
  const body = document.body;
  if(body && body.localName === 'frameset') {
    const noframes = document.querySelector('noframes');
    if(noframes) {
      body.innerHTML = noframes.innerHTML;
    } else {
      body.textContent = 'Unable to display document due to frames.';
    }
  }

  const elements = document.querySelectorAll('frameset, frame, iframe');
  const numElements = elements.length;
  for(let i = 0; i < numElements; i++) {
    elements[i].remove();
  }
};

DOMFilter.filterHiddenElements = function(document) {
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

  // TODO: do not remove hidden within removed hidden, so use move technique?
  // or experiment with a walk that finds shallowest descendants
  const elements = document.querySelectorAll(selector);
  const numElements = elements.length;
  for(let i = 0; i < numElements; i++) {
    elements[i].remove();
  }
};

// A set of names of inline elements that can be unwrapped
DOMFilter.INLINE_ELEMENT_NAMES = new Set([
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

DOMFilter.INLINE_ELEMENTS_SELECTOR = Array.from(
  DOMFilter.INLINE_ELEMENT_NAMES).join(',');

// Removes superfluous inline elements
// TODO: this is consistently the slowest component, and partly due
// to unwrap. maybe the unwrap detach parent overhead is silly?
// It is either the speed of unwrap itself, or the number of calls to unwrap.
// if it is the number of calls, this needs to be refactored.
DOMFilter.filterInlineElements = function(document) {

  // TODO: test using an explicit walk over all elemnts rather
  // than using a query selector
  // in the walk, use the VPrune.findAllShallow behavior? Or that is
  // still not quite right

  'use strict';
  const inlines = DOMFilter.INLINE_ELEMENT_NAMES;
  const selector = DOMFilter.INLINE_ELEMENTS_SELECTOR;
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
      DOMFilter.unwrap(element, farthest);
    }
  }
};

// Prunes leaf elements from the document. Leaf elements are those
// elements that do not contain sub elements, such as <p></p>, or elements
// that only contain other leaf-like elements but are not leaf-like, such as
// the outer paragraph in <p id="outer"><p id="nested-inner"></p></p>.
// The document element (e.g. <html></html>) and the document body are never
// considered leaves.
// Certain elements are treated differently. For example, <img> is never
// considered a leaf even though it has no nested elements or text.
DOMFilter.filterLeafElements = function(document) {
  'use strict';
  const leafSet = new Set();
  DOMFilter.collectLeavesRecursively(leafSet, document.body,
    document.documentElement);
  for(let leaf of leafSet) {
    leaf.remove();
  }
};

// Recursively traverses and finds leaf elements and adds them to leaves
// TODO: i would like to do this without recursion for better perf
DOMFilter.collectLeavesRecursively = function(leaves, bodyElement, element) {
  'use strict';
  const childNodes = element.childNodes;
  const numChildNodes = childNodes.length;
  for(let i = 0, cursor; i < numChildNodes; i++) {
    cursor = childNodes[i];
    if(cursor.nodeType === Node.ELEMENT_NODE) {
      if(DOMFilter.isLeafElement(bodyElement, cursor)) {
        leaves.add(cursor);
      } else {
        DOMFilter.collectLeavesRecursively(leaves, bodyElement, cursor);
      }
    }
  }
};

// Returns true if the given element is a leaf
// TODO: remove the bodyElement parameter
// TODO: make this non-recursive
DOMFilter.isLeafElement = function(bodyElement, element) {
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
      if(!DOMFilter.isLeafElement(bodyElement, node)) {
        return false;
      }
    } else {
      return false;
    }
  }

  return true;
};

// Unwraps anchors that are not links to other pages
DOMFilter.filterNominalAnchors = function(document) {
  'use strict';
  const elements = document.querySelectorAll('a');
  const numElements = elements.length;
  const unwrap = DOMFilter.unwrap;
  for(let i = 0, anchor; i < elements.length; i++) {
    anchor = elements[i];
    if(!anchor.hasAttribute('name') && !anchor.hasAttribute('href')) {
      unwrap(anchor);
    }
  }
};

DOMFilter.filterScriptElements = function(document) {
  'use strict';
  const elements = document.querySelectorAll('script');
  const numElements = elements.length;
  for(let i = 0; i < numElements; i++) {
    elements[i].remove();
  }
};

// NOTE: Due to content-loading tricks, noscript requires special handling
// e.g. nbcnews.com. I was originally unwrapping noscripts but it was
// leading to lots of garbage content. For now I am just removing until
// I give this more thought. There is also something I don't quite understand
// with a practice of using encoded html as the text content.
DOMFilter.filterNoScriptElements = function(document) {
  'use strict';
  const elements = document.querySelectorAll('noscript');
  const numElements = elements.length;
  for(let i = 0; i < numElements; i++) {
    elements[i].remove();
  }
};

// Disable anchors that use javascript protocol. Keep the href
// around for boilerplate analysis, and because I am not quite sure I want
// remove content beneath such anchors. If I just unwrap, this leads to lots
// of junk words like 'click me' in the text that are not links. If I remove,
// I risk removing informative content.
// TODO: maybe just always remove?
DOMFilter.filterJavascriptAnchors = function(document) {
  'use strict';
  const elements = document.querySelectorAll('a[href]');
  const numElements = elements.length;
  const pattern = /\s*javascript\s*:/i;
  for(let i = 0, anchor; i < numElements; i++) {
    anchor = elements[i];
    if(pattern.test(anchor.getAttribute('href'))) {
      anchor.setAttribute('href', '');
    }
  }
};

// Unwraps tables that consist of a single cell, which generally indicates
// a formatting purpose
DOMFilter.filterSingleCellTables = function(document) {
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
        parent = table.parentElement;
        parent.insertBefore(document.createTextNode(' '), table);
        for(node = cell.firstChild; node; node = cell.firstChild) {
          parent.insertBefore(node, table);
        }
        parent.insertBefore(document.createTextNode(' '), table);
        table.remove();
      }
    }
  }
};

// Transforms single column tables into paragraph separated row content
DOMFilter.filterSingleColumnTables = function(document) {
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
      DOMFilter.transformSingleColumnTable(table);
    }
  }
};

DOMFilter.transformSingleColumnTable = function(table) {
  'use strict';
  const parent = table.parentElement;
  const document = table.ownerDocument;
  for(let rows = table.rows, numRows = rows.length, rowIndex = 0,
    columnIndex = 0, cell, cells, numCells = 0, firstChild; rowIndex < numRows;
    rowIndex++) {
    for(columnIndex = 0, cells = rows[rowIndex], numCells = cells.length;
      columnIndex < numCells; columnIndex++) {
      for(cell = cells[columnIndex], firstChild = cell.firstChild; firstChild;
        firstChild = cell.firstChild) {
        parent.insertBefore(firstChild, table);
      }
    }

    parent.insertBefore(document.createElement('p'), table);
  }

  table.remove();
};

DOMFilter.filterSingleItemLists = function(document) {
  'use strict';
  const lists = document.querySelectorAll('ul, ol');
  const numLists = lists.length;
  for(let i = 0, list, node, item, parent; i < numLists; i++) {
    list = lists[i];
    if(list.childElementCount === 1) {
      item = list.firstElementChild;
      if(item.localName === 'li') {
        parent = list.parentNode;
        for(node = item.firstChild; node; node = item.firstChild) {
          parent.insertBefore(node, list);
        }
        list.remove();
      }
    }
  }
};

DOMFilter.filterSourcelessImages = function(document) {
  'use strict';
  const images = document.querySelectorAll('img');
  const numImages = images.length;
  for(let i = 0, image; i < numImages; i++) {
    image = images[i];
    if(!image.hasAttribute('src') && !image.hasAttribute('srcset')) {
      image.remove();
    }
  }
};

DOMFilter.filterTracerImages = function(document) {
  'use strict';
  const images = document.querySelectorAll('img');
  const numImages = images.length;
  for(let i = 0, image; i < numImages; i++) {
    image = images[i];
    if(image.width < 2 || image.height < 2) {
      image.remove();
    }
  }
};

DOMFilter.normalizeWhitespace = function(document) {
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
};

// Condenses whitespace of text nodes
DOMFilter.condenseNodeValues = function(document) {
  'use strict';
  const it = document.createNodeIterator(document.documentElement,
    NodeFilter.SHOW_TEXT);
  const TWO_OR_MORE_SPACES = /\s{2,}/g;
  const selector = 'code, pre, ruby, textarea, xmp';
  for(let node = it.nextNode(); node; node = it.nextNode()) {
    if(node.nodeValue && !node.parentNode.closest(selector)) {
      node.nodeValue = node.nodeValue.replace(TWO_OR_MORE_SPACES, ' ');
    }
  }
};

DOMFilter.trimDocument = function(document) {
  'use strict';
  const isTrimmable = DOMFilter.isTrimmableNode;
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
};

DOMFilter.isTrimmableNode = function(node) {
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
};

// Trims a document's text nodes
DOMFilter.trimTextNodes = function(document) {
  'use strict';

  const isInlineElement = DOMFilter.isNoTrimInlineElement;
  const it = document.createNodeIterator(document.documentElement,
    NodeFilter.SHOW_TEXT);
  const selector = 'code, pre, ruby, textarea, xmp';

  for(let node = it.nextNode(); node; node = it.nextNode()) {

    // If the node is a descendant of a whitespace sensitive element,
    // do not modify its value
    if(node.parentNode.closest(selector)) {
      continue;
    }

    if(node.previousSibling) {
      if(node.previousSibling.nodeType === Node.ELEMENT_NODE) {
        if(isInlineElement(node.previousSibling)) {
          if(node.nextSibling) {
            if(node.nextSibling.nodeType === Node.ELEMENT_NODE) {
              if(!isInlineElement(node.nextSibling)) {
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
            if(isInlineElement(node.nextSibling)) {
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
        if(isInlineElement(node.nextSibling)) {
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
};

DOMFilter.filterEmptyTextNodes = function(document) {
  'use strict';
  const it = document.createNodeIterator(document.documentElement,
    NodeFilter.SHOW_TEXT);
  for(let node = it.nextNode(); node; node = it.nextNode()) {
    if(!node.nodeValue) {
      node.remove();
    }
  }
};

DOMFilter.isNoTrimInlineElement = function(element) {
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
};

// Unwraps the element's child nodes into the parent of the element or, if
// provided, the parent of the alternate element
// https://code.google.com/p/chromium/issues/detail?id=419780

DOMFilter.unwrap = function(element, alternate) {
  'use strict';
  const numChildNodes = element.childNodes.length;
  const document = element.ownerDocument;
  const target = alternate || element;
  const parent = target.parentElement;
  const insertChildrenBefore = function(element, referenceNode) {
    const parent = referenceNode.parentElement;
    for(let node = element.firstChild; node; node = element.firstChild) {
      parent.insertBefore(node, referenceNode);
    }
  };

  if(numChildNodes && parent) {
    if(target.previousSibling &&
      target.previousSibling.nodeType === Node.TEXT_NODE) {
      parent.insertBefore(document.createTextNode(' '), target);
    }

    const grandParent = parent.parentElement;
    if(grandParent && numChildNodes > 2) {
      const nextSibling = parent.nextSibling;
      parent.remove();
      insertChildrenBefore(element, target);
      grandParent.insertBefore(parent, nextSibling || null);
    } else {
      insertChildrenBefore(element, target);
    }

    if(target.nextSibling && target.nextSibling.nodeType === Node.TEXT_NODE) {
      parent.insertBefore(document.createTextNode(' '), target);
    }
  }

  target.remove();
};
