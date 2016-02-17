// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

const DOMFilter = {};

// Returns whether the element has the given lowercase name
DOMFilter.elementHasName = function(name, element) {
  'use strict';
  return element.localName === name;
};

DOMFilter.nodeHasType = function(nodeType, node) {
  'use strict';
  return node.nodeType === nodeType;
};

DOMFilter.isElement = DOMFilter.nodeHasType.bind(null, Node.ELEMENT_NODE);
DOMFilter.isTextNode = DOMFilter.nodeHasType.bind(null, Node.TEXT_NODE);

DOMFilter.findImageCaption = function(image) {
  'use strict';
  const figure = image.closest('figure');
  return figure ? figure.querySelector('figcaption') : null;
};

DOMFilter.getCommentNodeIterator = function(document) {
  'use strict';
  const iterator = document.createNodeIterator(
    document.documentElement,
    NodeFilter.SHOW_COMMENT);
  iterator[Symbol.iterator] = DOMFilter.getNodeIteratorSymbolIterator(
    iterator);
  return iterator;
};

DOMFilter.getTextNodeIterator = function(document) {
  'use strict';
  const iterator = document.createNodeIterator(
    document.documentElement,
    NodeFilter.SHOW_TEXT);
  iterator[Symbol.iterator] = DOMFilter.getNodeIteratorSymbolIterator(
    iterator);
  return iterator;
};

// Allows for..of over NodeIterators, to use do:
DOMFilter.getNodeIteratorSymbolIterator = function(iterator) {
  'use strict';
  return function() {
    return {
      next: function() {
        const node = iterator.nextNode();
        return { value: node, done: !node };
      }
    };
  };
};

// Removes all comment nodes from the document
DOMFilter.filterCommentNodes = function(document) {
  'use strict';
  for(let comment of DOMFilter.getCommentNodeIterator(document)) {
    comment.remove();
  }
};

DOMFilter.DEFAULT_BLACKLIST_POLICY = new Set([
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
]);

// @param policy {Set} element names to remove
DOMFilter.filterBlacklistedElements = function(document, policy) {
  'use strict';
  const selector = Array.from(policy ||
    DOMFilter.DEFAULT_BLACKLIST_POLICY).join(',');
  DOMFilter.moveElementsBySelector(document, null, selector);
};

// Replaces <br> elements within a document with <p>
// TODO: this function needs some substantial improvement. there are several
// problems with its current approach, such as what happens when inserting
// a paragraph element within an inline element.
// error case: http://paulgraham.com/procrastination.html
DOMFilter.filterBreakruleElements = function(document) {
  'use strict';
  const breakRuleElements = document.querySelectorAll('br');
  breakRuleElements[Symbol.iterator] = Array.prototype[Symbol.iterator];
  for(let breakRuleElement of breakRuleElements) {
    let parent = breakRuleElement.parentElement;
    let paragraph = document.createElement('p');
    parent.replaceChild(paragraph, breakRuleElement);
  }
};

// Removes certain attributes from all elements in the document
DOMFilter.filterAttributes = function(document) {
  'use strict';
  const elements = document.getElementsByTagName('*');
  elements[Symbol.iterator] = Array.prototype[Symbol.iterator];
  for(let element of elements) {
    DOMFilter.filterElementAttributes(element);
  }
};

// Removes certain attributes from an element
DOMFilter.filterElementAttributes = function(element) {
  'use strict';
  const elementName = element.localName;

  if(elementName === 'svg' || elementName === 'path') {
    return;
  }

  // Iterate in reverse to avoid issues with mutating a live NodeList during
  // iteration
  const attributes = element.attributes || [];
  for(let j = attributes.length - 1, attributeName; j > -1; j--) {
    attributeName = attributes[j].name;
    if(!DOMFilter.isPermittedAttribute(elementName, attributeName)) {
      element.removeAttribute(attributeName);
    }
  }
};

// Returns whether an attribute should not be removed
DOMFilter.isPermittedAttribute = function(elementName, attributeName) {
  'use strict';
  if(elementName === 'a') {
    return attributeName === 'href' ||
      attributeName === 'name' ||
      attributeName === 'title';
  }

  if(elementName === 'html') {
    return attributeName === 'lang';
  }

  if(elementName === 'iframe') {
    return attributeName === 'src';
  }

  if(elementName === 'img') {
    return attributeName === 'alt' || attributeName === 'src' ||
      attributeName === 'srcset' || attributeName === 'title';
  }

  if(elementName === 'param') {
    return attributeName === 'name' || attributeName === 'value';
  }

  return false;
};

// Filters frame, noframes, frameset, and iframe elements
DOMFilter.filterFrameElements = function(document) {
  'use strict';
  let body = document.querySelector('body');
  const frameset = document.querySelector('frameset');
  if(!body && frameset) {
    const noframes = frameset.querySelector('noframes');
    body = document.createElement('body');
    if(noframes) {
      body.innerHTML = noframes.innerHTML;
    } else {
      body.textContent = 'Unable to display document due to frames.';
    }

    document.documentElement.appendChild(body);
    frameset.remove();
    return;
  }

  DOMFilter.removeElementsBySelector(document, 'frameset, frame, iframe');
};

//TODO: review aria properties, maybe include aria hidden?
// https://www.w3.org/TR/wai-aria/states_and_properties#aria-hidden
DOMFilter.HIDDEN_ELEMENTS_SELECTOR = [
  '[style*="display:none"]',
  '[style*="display: none"]',
  '[style*="visibility:hidden"]',
  '[style*="visibility: hidden"]',
  '[style*="opacity:0.0"]',
  '[style*="opacity: 0.0"]',
  '[style*="opacity:0"]'
].join(',');

// Removes hidden elements from a document. This function previously was more
// accurate and investigated each element's style property. However, this
// resulted in Chrome lazily computing each element's style, which resulted in
// poor performance. Given that we are ignoring non-inline styles in the first
// place, I don't think the loss of accuracy is too important.
DOMFilter.filterHiddenElements = function(document) {
  'use strict';
  DOMFilter.removeElementsBySelector(document,
    DOMFilter.HIDDEN_ELEMENTS_SELECTOR);
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

DOMFilter.isInlineElement = function(element) {
  'use strict';
  return DOMFilter.INLINE_ELEMENT_NAMES.has(element.localName);
};

// Removes superfluous inline elements
DOMFilter.filterInlineElements = function(document) {
  'use strict';
  for(let element of selectInlineElements(document)) {
    if(!isIntermediateInlineAncestor(element)) {
      DOMFilter.unwrap(element, findFarthestInlineAncestor(element));
    }
  }

  function selectInlineElements(document) {
    const elements = document.querySelectorAll(
      DOMFilter.INLINE_ELEMENTS_SELECTOR);
    elements[Symbol.iterator] = Array.prototype[Symbol.iterator];
    return elements;
  }

  function isIntermediateInlineAncestor(element) {
    return DOMFilter.isInlineElement(element) &&
      element.childNodes.length === 1 &&
      DOMFilter.isInlineElement(element.firstChild);
  }

  function findFarthestInlineAncestor(element) {
    let result = null;
    for(let cursor = element.parentElement; cursor &&
      isIntermediateInlineAncestor(cursor); cursor = cursor.parentElement) {
      result = cursor;
    }
    return result;
  }
};

// These element names are never considered leaves
DOMFilter.LEAF_EXCEPTION_ELEMENT_NAMES = new Set([
  'area',
  'audio',
  'br',
  'canvas',
  'col',
  'hr',
  'iframe',
  'img',
  'path', // an SVG component
  'source',
  'svg',
  'track',
  'video'
]);

// Elements containing only these text node values are still leaves
DOMFilter.TRIVIAL_TEXT_NODE_VALUES = new Set([
  '',
  '\n',
  '\n\t',
  '\n\t\t',
  '\n\t\t\t'
]);

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
    if(DOMFilter.isElement(cursor)) {
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

  if(DOMFilter.LEAF_EXCEPTION_ELEMENT_NAMES.has(element.localName)) {
    return false;
  }

  const childNodes = element.childNodes;
  childNodes[Symbol.iterator] = Array.prototype[Symbol.iterator];

  for(let childNode of childNodes) {
    if(childNode.nodeType === Node.TEXT_NODE) {
      if(!DOMFilter.TRIVIAL_TEXT_NODE_VALUES.has(childNode.nodeValue)) {
        return false;
      }
    } else if(DOMFilter.isElement(childNode)) {
      if(!DOMFilter.isLeafElement(bodyElement, childNode)) {
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
  const anchors = document.querySelectorAll('a');
  anchors[Symbol.iterator] = Array.prototype[Symbol.iterator];
  for(let anchor of anchors) {
    if(!anchor.hasAttribute('name')) {
      let href = anchor.getAttribute('href') || '';
      href = href.trim();
      if(!href) {
        DOMFilter.unwrap(anchor);
      }
    }
  }
};

DOMFilter.filterScriptElements = function(document) {
  'use strict';
  DOMFilter.removeElementsBySelector(document, 'script');
};

// NOTE: Due to content-loading tricks, noscript requires special handling
// e.g. nbcnews.com. I was originally unwrapping noscripts but it was
// leading to lots of garbage content. For now I am just removing until
// I give this more thought. There is also something I don't quite understand
// with a practice of using encoded html as the text content.
DOMFilter.filterNoScriptElements = function(document) {
  'use strict';
  DOMFilter.removeElementsBySelector(document, 'noscript');
};

// Disable anchors that use javascript protocol. Keep the href
// around for boilerplate analysis, and because I am not quite sure I want
// remove content beneath such anchors. If I just unwrap, this leads to lots
// of junk words like 'click me' in the text that are not links. If I remove,
// I risk removing informative content.
DOMFilter.filterJavascriptAnchors = function(document) {
  'use strict';
  const anchors = document.querySelectorAll('a[href]');
  anchors[Symbol.iterator] = Array.prototype[Symbol.iterator];
  for(let anchor of anchors) {
    if(DOMFilter.isJavascriptAnchor(anchor)) {
      anchor.setAttribute('href', '');
    }
  }
};

// Returns whether the anchor is a javascript anchor
// NOTE: rather than use a regex, we can take advantage of the accurate
// parsing of the browser (and mirror its behavior for that matter) by
// just accessing the protocol property.
// NOTE: this occassionally yields poor performance for some reason, maybe
// the regex is faster
DOMFilter.isJavascriptAnchor = function(anchor) {
  'use strict';
  return anchor.protocol === 'javascript:';
};

// Unwraps tables that consist of a single cell, which generally indicates
// a formatting purpose
DOMFilter.filterSingleCellTables = function(document) {
  'use strict';
  const tables = document.querySelectorAll('table');
  tables[Symbol.iterator] = Array.prototype[Symbol.iterator];
  for(let table of tables) {
    let cell = DOMFilter.getTableSingleCell(table);
    if(cell) {
      DOMFilter.unwrapSingleCellTable(table, cell);
    }
  }
};

// Returns the single cell of a table iff it is a single cell table,
// which means it has only 1 row and 1 column. This is implemented to return
// the element instead of a boolean so that subsequent code does not need to
// find the cell again.
DOMFilter.getTableSingleCell = function(table) {
  'use strict';
  const rows = table.rows;
  let cell = null;
  if(rows.length === 1) {
    let cells = rows[0].cells;
    if(cells.length === 1) {
      cell = cells[0];
    }
  }

  return cell;
};

// Replaces a table in the dom with the child nodes of its single cell
// TODO: detach before unwrap to reduce dom ops (see unwrap)
DOMFilter.unwrapSingleCellTable = function(table, cell) {
  'use strict';
  const parent = table.parentElement;
  const document = table.ownerDocument;
  for(let node = cell.firstChild; node; node = cell.firstChild) {
    parent.insertBefore(node, table);
  }
  parent.insertBefore(document.createTextNode(' '), table);
  table.remove();
};

// Transforms single column tables into paragraph separated row content
DOMFilter.filterSingleColumnTables = function(document) {
  'use strict';
  const tables = document.querySelectorAll('table');
  tables[Symbol.iterator] = Array.prototype[Symbol.iterator];
  for(let table of tables) {
    if(DOMFilter.isSingleColumnTable(table)) {
      DOMFilter.transformSingleColumnTable(table);
    }
  }
};

// Returns true if the table appears to consist of only a single column
DOMFilter.isSingleColumnTable = function(table) {
  'use strict';
  const rows = table.rows;
  const upperBound = Math.min(rows.length, 20);
  let isSingleColumn = true;
  for(let i = 0; i < upperBound; i++) {
    if(rows[i].cells.length > 1) {
      isSingleColumn = false;
      break;
    }
  }

  return isSingleColumn;
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
  lists[Symbol.iterator] = Array.prototype[Symbol.iterator];
  for(let list of lists) {
    if(DOMFilter.countListItems(list) === 1) {
      DOMFilter.unwrapSingleItemList(list);
    }
  }
};

DOMFilter.isListItem = DOMFilter.elementHasName.bind(null, 'li');

DOMFilter.countListItems = function(list) {
  'use strict';
  const childNodes = list.childNodes;
  childNodes[Symbol.iterator] = Array.prototype[Symbol.iterator];
  let count = 0;
  for(let childNode of childNodes) {
    if(DOMFilter.isListItem(childNode)) {
      count++;
    }
  }
  return count;
};

DOMFilter.getFirstListItem = function(list) {
  'use strict';
  return Array.prototype.find.call(list.childNodes, DOMFilter.isListItem);
};

// assumes the list item count > 0
DOMFilter.unwrapSingleItemList = function(list) {
  'use strict';
  const parent = list.parentElement;
  const item = DOMFilter.getFirstListItem(list);
  while(item.firstChild) {
    parent.insertBefore(item.firstChild, list);
  }
  list.remove();
};

// Removes images without a source
DOMFilter.filterSourcelessImages = function(document) {
  'use strict';
  const images = document.querySelectorAll('img');
  images[Symbol.iterator] = Array.prototype[Symbol.iterator];
  for(let image of images) {
    if(DOMFilter.isSourcelessImage(image)) {
      image.remove();
    }
  }
};

// NOTE: using hasAttribute allows for whitespace-only values, but I do not
// think this is too important
// NOTE: access by attribute, not by property, because the browser may
// supply a base url prefix or something like that to the property
DOMFilter.isSourcelessImage = function(image) {
  'use strict';
  return !image.hasAttribute('src') && !image.hasAttribute('srcset');
};

// Removes all tracer images
DOMFilter.filterTracerImages = function(document) {
  'use strict';
  const images = document.querySelectorAll('img');
  images[Symbol.iterator] = Array.prototype[Symbol.iterator];
  for(let image of images) {
    if(DOMFilter.isTracerImage(image)) {
      image.remove();
    }
  }
};

// This function considers width and height independently, resulting in removal
// of not just tracer images but also images used as horizontal rule elements
// or vertical bars, which is desired.
// This requires the dimensions be set. If an image does not have dimension
// attributes, it should be pre-fetched before calling this.
DOMFilter.isTracerImage = function(image) {
  'use strict';
  return image.width < 2 || image.height < 2;
};

// Moves elements matching the selector query from the source document into
// the destination document. This function iterates over elements in the node
// list generated as a result of querySelectorAll. Once an element is moved,
// its children are implicitly also moved. If a child also matches the selector
// query, it is not moved again.
// This function works similarly to removeElementsBySelector, but potentially
// performs fewer dom manipulations because of how it avoids manipulating
// child elements of moved elements. In theory, this can lead to better
// performance. This also achieves better technical accuracy, because the fact
// that removed/moved child elements remain in the node list even after a parent
// was removed/moved, is undesirable behavior. Unfortunately, I cannot think of
// a way to accomplish the desired behavior using the native API provided.
// If destination is undefined, then a dummy document is supplied, which is
// discarded when the function completes, which results in the elements being
// simply removed from the source document.
// @param source {Document}
// @param destination {Document}
// @param selector {String}
// @returns void
DOMFilter.moveElementsBySelector = function(source, destination, selector) {
  'use strict';
  const targetDocument = destination ||
    document.implementation.createHTMLDocument();
  const elements = source.querySelectorAll(selector);
  elements[Symbol.iterator] = Array.prototype[Symbol.iterator];
  for(let element of elements) {
    if(element.ownerDocument === source) {
      targetDocument.adoptNode(element);
    }
  }
};

// Finds all elements with the given tagName and removes them,
// in reverse document order. This will remove elements that do not need to
// be removed because an ancestor of them will be removed in a later iteration.
// NOTE: this ONLY works in reverse. getElementsByTagName returns a LIVE
// NodeList/HTMLCollection. Removing elements from the list while iterating
// screws up all later index access when iterating forward. To avoid this,
// use a non-live list such as the one returned by querySelectorAll.
DOMFilter.removeElementsByName = function(document, tagName) {
  'use strict';
  const elements = document.getElementsByTagName(tagName);
  const numElements = elements.length;
  for(let i = numElements - 1; i > -1; i--) {
    elements[i].remove();
  }
};

// Finds all elements matching the selector and removes them,
// in forward document order. In contrast to moveElementsBySelector, this
// removes elements that are descendants of elements already removed.
// NOTE: i tried to find a way to avoid visiting detached subtrees, but
// document.contains still returns true for a removed element. The only way
// seems to be to traverse upwards and checking if documentElement is still at
// the top of the ancestors chain. That is obviously too inefficient, and
// probably less efficient than just visiting descendants. The real tradeoff
// is whether the set of remove operations is slower than the time it takes
// to traverse. I assume traversal is faster, but not fast enough to merit it.
DOMFilter.removeElementsBySelector = function(document, selector) {
  'use strict';
  const elements = document.querySelectorAll(selector);
  const remove = function(element) { element.remove(); };
  Array.prototype.forEach.call(elements, remove);
};

// Normalizes the values of all text nodes in a document
DOMFilter.normalizeWhitespace = function(document) {
  'use strict';
  for(let node of DOMFilter.getTextNodeIterator(document)) {
    let value = node.nodeValue;
    if(!DOMFilter.TRIVIAL_TEXT_NODE_VALUES.has(value)) {
      node.nodeValue = value.replace(/&nbsp;/g, ' ');
    }
  }
};

// Condenses spaces of text nodes that are not descendants of whitespace
// sensitive elements such as <pre>. This expects that node values were
// previous normalized, so, for example, it does not consider &nbsp;.
DOMFilter.condenseNodeValues = function(document, sensitiveElements) {
  'use strict';
  for(let node of DOMFilter.getTextNodeIterator(document)) {
    if(!sensitiveElements.has(node.parentElement)) {
      node.nodeValue = DOMFilter.condenseSpaces(node.nodeValue);
    }
  }
};

// Replaces one or more consecutive spaces with a single space
DOMFilter.condenseSpaces = function(inputString) {
  'use strict';
  return inputString.replace(/ +/g, ' ');
};

// Removes trimmable elements from the start and end of the document
// NOTE: should isTrimmableElement be merged or share functionality with
// the isLeafElement function?
// NOTE: should only be called after filterLeafElements if that is ever called
// TODO: don't require body, e.g. let root = document.body ||
// document.documentElement
DOMFilter.trimDocument = function(document) {
  'use strict';
  if(document.body) {
    let sibling = document.body;
    let node = document.body.firstChild;
    while(node && DOMFilter.isTrimmableNode(node)) {
      sibling = node.nextSibling;
      node.remove();
      node = sibling;
    }

    node = document.body.lastChild;
    while(node && DOMFilter.isTrimmableNode(node)) {
      sibling = node.previousSibling;
      node.remove();
      node = sibling;
    }
  }
};

DOMFilter.TRIMMABLE_NODE_NAMES = new Set([
  'br', 'hr', 'nobr'
]);

DOMFilter.isTrimmableNode = function(node) {
  'use strict';
  return DOMFilter.isElement(node) &&
    (DOMFilter.TRIMMABLE_NODE_NAMES.has(node.localName) ||
    DOMFilter.isEmptyParagraph(node));
};

DOMFilter.isEmptyParagraph = function(element) {
  'use strict';
  return element && element.localName === 'p' && !element.firstChild;
};

// Trims a document's text nodes
DOMFilter.trimTextNodes = function(document, sensitiveElements) {
  'use strict';

  const isElement = DOMFilter.isElement;
  const isInlineElement = DOMFilter.isInlineElementNoTrim;
  for(let node of DOMFilter.getTextNodeIterator(document)) {

    if(sensitiveElements.has(node.parentElement)) {
      continue;
    }

    if(node.previousSibling) {
      if(isElement(node.previousSibling)) {
        if(isInlineElement(node.previousSibling)) {
          if(node.nextSibling) {
            if(isElement(node.nextSibling)) {
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
          if(isElement(node.nextSibling)) {
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
     if(isElement(node.nextSibling)) {
        if(isInlineElement(node.nextSibling)) {
          node.nodeValue = node.nodeValue.trimLeft();
        } else {
          node.nodeValue = node.nodeValue.trim();
        }
      } else {
        node.nodeValue = node.nodeValue.trimLeft();
      }
    } else {
      // In this branch, we have a text node that has no siblings, which is
      // generally a text node within an inline element.
      // It feels like we want to full trim here, but we actually do not want
      // to trim, because it causes a funky display error where text following
      // an inline element's text is immediately adjacent to the inline
      // text. Not full-trimming here leaves trailing whitespace in the inline
      // element, which avoids the issue. I suppose, alternatively, we could
      // introduce a single space after the element, but that seems strange.
      node.nodeValue = node.nodeValue.trimLeft();
    }
  }
};

DOMFilter.filterEmptyTextNodes = function(document) {
  'use strict';
  for(let node of DOMFilter.getTextNodeIterator(document)) {
    if(!node.nodeValue) {
      node.remove();
    }
  }
};

// These elements are whitespace sensitive
// TODO: use a Set?
DOMFilter.SENSITIVE_ELEMENTS_SELECTOR = [
  'code',
  'code *',
  'pre',
  'pre *',
  'ruby',
  'ruby *',
  'textarea',
  'textarea *',
  'xmp',
  'xmp *'
].join(',');

// Return a set of elements that are whitespace sensitive. This is useful
// for checking whether a text node has an ancestor that deems it as sensitive.
// Rather than walking the ancestor chain each time to do such a check, we
// collect all such elements and their descendants into a large set, so that
// we can simply check if a text node's parent element is a member.
// TODO: see if I can avoid Array.from
DOMFilter.getSensitiveSet = function(document) {
  'use strict';
  const sensitiveElements = document.querySelectorAll(
    DOMFilter.SENSITIVE_ELEMENTS_SELECTOR);
  return new Set(Array.from(sensitiveElements));
};

DOMFilter.INLINE_ELEMENTS_NO_TRIM = new Set([
  'a',
  'abbr',
  'acronym',
  'address',
  'b',
  'bdi',
  'bdo',
  'blink',
  'cite',
  'code',
  'data',
  'del',
  'dfn',
  'em',
  'font',
  'i',
  'ins',
  'kbd',
  'mark',
  'map',
  'meter',
  'q',
  'rp',
  'rt',
  'samp',
  'small',
  'span',
  'strike',
  'strong',
  'sub',
  'sup',
  'time',
  'tt',
  'u',
  'var'
]);

DOMFilter.isInlineElementNoTrim = function(element) {
  'use strict';
  return DOMFilter.INLINE_ELEMENTS_NO_TRIM.has(element.localName);
};

// Unwraps the element's child nodes into the parent of the element or, if
// provided, the parent of the alternate element
// https://developer.mozilla.org/en-US/docs/Web/API/Node/insertBefore
// https://code.google.com/p/chromium/issues/detail?id=419780
// I don't need to choose between appendChild and insertBefore, I just
// need to use nextSibling || null
DOMFilter.unwrap = function(element, alternate) {
  'use strict';
  const isTextNode = DOMFilter.isTextNode;
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
    if(target.previousSibling && isTextNode(target.previousSibling)) {
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

    if(target.nextSibling && isTextNode(target.nextSibling)) {
      parent.insertBefore(document.createTextNode(' '), target);
    }
  }

  target.remove();
};
