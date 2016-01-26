// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

// Requires: /dom/dom-module.js

// TODO: merge dom-module into this
// TODO: use an IIFE to avoid global strict mode? Or move use strict into
// every function

'use strict';

const DOMFilter = {};

// Create a custom iterator wrapper around NodeList because
// I do not want to modify NodeList.prototype and Chrome does not yet
// support iterable node lists. So this is a placeholder function to remind me
// of this idea of how to allow all my other iterating functions that work
// with nodelists to use for..of.
DOMFilter.createNodeListIterator = function(nodeList) {
  throw new Error('Not implemented');
};

// Returns true if the element is a figure element
// TODO: look into the canonical way of doing this. For example, is it more
// standard to use tagName, or instanceof like in the case of
// element instanceof HTMLFigureElement?
DOMFilter.isFigureElement = function(element) {
  return element.localName === 'figure';
};


// Finds the associated caption for an image element
// TODO: optimize? For example, maybe I should just be searching ancestors
// and returning the first matching ancestor, instead of storing all ancestors
// in an array. Maybe I need a findAncestor function? However, this involves
// not using the native Array.prototype.find function, so I am not sure.
// TODO: rename to selectImageCaption or selectCaption as only images
// have captions? or can other elements have captions, like tables?
// TODO: maybe move this into calamine if that is the only context for it
DOMFilter.findImageCaption = function(image) {
  const isFigureElement = DOMFilter.isFigureElement;
  const getNodeAncestors = DOMFilter.getNodeAncestors;
  const ancestors = getNodeAncestors(image);
  const figure = ancestors.find(isFigureElement);
  let caption = null;
  if(figure) {
    caption = figure.querySelector('figcaption');
  }
  return caption;
};

// Returns an array of ancestor elements for the given node up to and including
// the documentElement, in bottom up order
DOMFilter.getNodeAncestors = function(node) {
  const ancestors = [];
  let parentElement = node.parentElement;
  while(parentElement) {
    ancestors.push(parentElement);
    parentElement = parentElement.parentElement;
  }
  return ancestors;
};

// Removes all comment nodes from the document
DOMFilter.filterCommentNodes = function(document) {
  const iterator = document.createNodeIterator(document.documentElement,
    NodeFilter.SHOW_COMMENT);
  for(let comment = iterator.nextNode(); comment;
    comment = iterator.nextNode()) {
    comment.remove();
  }
};

// TODO: i don't like how filterBlacklistedElements hardcodes which elements
// to remove, and how it encompasses multiple purposes, so it needs some
// redesign, maybe use a default set of blacklisted that is configurable?
DOMFilter.filterBlacklistedElements = function(document) {

  const blacklist = [
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

  const blacklistSelector = blacklist.join(',');
  DOMFilter.moveElementsBySelector(document, null, blacklistSelector);
};

// Replaces <br> elements within a document with <p>
// TODO: this function needs some substantial improvement. there are several
// problems with its current approach, such as what happens when inserting
// a paragraph element within an inline element.
// error case: http://paulgraham.com/procrastination.html
// TODO: does using const in loop still cause deopts?
DOMFilter.filterBreakruleElements = function(document) {
  const elements = document.querySelectorAll('br');
  const numElements = elements.length;
  for(let i = 0; i < numElements; i++) {
    const element = elements[i];
    const parent = element.parentElement;
    const p = document.createElement('p');
    parent.replaceChild(p, element);
  }
};

// Removes attributes from elements in the document
// TODO: only allow the retainable attributes on the proper elements that can
// have them, instead of on any element (e.g. only images can have a src
// attribute)
// TODO: don't recreate the exception set each call
DOMFilter.filterElementAttributes = function(document) {

  const RETAIN_ATTRIBUTE_NAMES = new Set([
    'alt',
    'href',
    'src',
    // New HTML responsive design in images
    'srcset',
    'title'
  ]);

  const elements = document.getElementsByTagName('*');
  let attributes = null;
  let name = '';
  let element = null;
  for(let i = 0, j = 0, len = elements.length; i < len; i++) {
    element = elements[i];

    // Skip SVG
    // TODO: but what about onclick and such? this would be a security hole
    // TODO: leaving in SVG turns out to cause some funky display issues,
    // so this requires more thought. For example, I observed an article where
    // the SVG element was permanently floating in higher layer over the
    // article's actual text, making the article unreadable.
    // TODO: maybe svg and path should just be blacklisted
    if(element.localName === 'svg' || element.localName === 'path') {
      continue;
    }

    attributes = element.attributes;

    if(!attributes) {
      continue;
    }

    // NOTE: we iterate in reverse to avoid issues with mutating a live
    // NodeList while iterating
    for(j = attributes.length - 1; j > -1; j--) {
      name = attributes[j].name;
      if(!RETAIN_ATTRIBUTE_NAMES.has(name)) {
        element.removeAttribute(name);
      }
    }
  }
};

// Handles frame, noframes, frameset, and iframe elements
// Looks for the presence of a frameset and lack of a body
// element, and then removes the frameset and generates a body
// consisting of either noframes content or an error message.
// TODO: this may need to be a more general transform that is async
// and automatically identifies the core content frame, fetches its content,
// and then incorporates it into the document
// TODO: i want to consider inlining iframe content
// TODO: iframes are frame-like, but in the end, i think iframe filtering
// or handling should be done in its own transformational function, and not
// mixed-in here.
// TODO: the replacement text should be localized
// TODO: what if noframes contains an iframe or other frames?
DOMFilter.filterFrameElements = function(document) {
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

DOMFilter.HIDDEN_ELEMENTS_SELECTOR = [
  '[style*="display:none"]',
  '[style*="display: none"]',
  '[style*="visibility:hidden"]',
  '[style*="visibility: hidden"]',
  '[style*="opacity:0.0"]',
  '[style*="opacity: 0.0"]',
  '[style*="opacity:0"]'
].join(',');

// Removes hidden elements from a document.
// NOTE: this originally iterated over all elements and tested against
// each element's style property. Performance analysis showed this was
// very slow. So we sacrifice accuracy to move most of the traveral
// operations to a native querySelectorAll call. The selectors here do
// not match ALL hidden elements. First, we
// are only looking at inline styles and not considering the other
// relevant CSS, so we are already simplifying the problem and allowing
// for hidden elements. Second, hidden elements do not show up in the
// output.
// This is really only a component of compression, which isn't
// the primary purpose of the overall application.
// It may have some impact on boilerplate analysis, but I haven't given that
// too much consideration.
DOMFilter.filterHiddenElements = function(document) {
  DOMFilter.removeElementsBySelector(document,
    DOMFilter.HIDDEN_ELEMENTS_SELECTOR);
};

// A set of names of inline elements that can be safely unwrapped
// NOTE: This does not contain ALL inline elements, just those we
// want to unwrap. This is different than the set of inline
// elements defined for the purpose of trimming text nodes.
// TODO: some of these would maybe be better handled in other more
// specialized handlers
// noscript and noembed are handled by other transforms
DOMFilter.INLINE_ELEMENTS_SELECTOR = Array.from(new Set([
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
])).join(',');

// Unwraps various inline elements in a document. Given that style information
// and other information is removed, several elements in the document may
// no longer serve a formatting purpose, so we want to remove them but
// keep the child elements. Because the topology serves as a feature in
// boilerplate extraction, this should only be done after analyzing the content
// for boilerplate.
// TODO: this is doing some wasted operations in the case of nested
// inline elements. For example, for <div><div>content</div><div>,
// content should be hoisted all the way outside of the div in a single
// move. Right now it unwraps both inner and outer, doing the move twice. So
// instead of finding the parent in unwrap, we would want to walk up the
// ancestor tree to the first non-unwrappable (stopping before document.body).
// I think this means we cannot use unwrapElement, because that
// hardcodes the move destination as element.parentElement
DOMFilter.filterInlineElements = function(document) {
  const unwrapElement = DOMFilter.unwrapElement;
  const elements = document.querySelectorAll(
    DOMFilter.INLINE_ELEMENTS_SELECTOR);
  const numElements = elements.length;
  for(let i = 0; i < numElements; i++) {
    unwrapElement(elements[i]);
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
DOMFilter.LEAF_TRIVIAL_TEXT_NODE_VALUES = new Set([
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
// Elements that contain only trivial text nodes are still considered leaves,
// such as <p>\n</p>
// TODO: this could still use improvement. it is revisiting and
// re-evaluating children sometimes.
// TODO: i would like to do this without recursion for better perf
// TODO: does the resulting set of leaves contain leaves within
// leaves? i want to avoid removing leaves within leaves.
// TODO: test cases
// TODO: i would like to do this without having a visitor function and
// an isLeaf function that also visits, it feels wrong.
// TODO: if we treat the document as a DAG, we can use graph principles,
// and process the document as if it were a graph. maybe we need a graph
// library.
// TODO: maybe what i should do is gather all leaves, then remove, so write
// a funciton that abstracts the gathering
DOMFilter.filterLeafElements = function(document) {
  const visit = DOMFilter._filterLeafElementsVisit;
  const leaves = new Set();
  visit(leaves, document.body, document.documentElement);
  for(let leaf of leaves) {
    // console.debug('Removing leaf: ', leaf.outerHTML);
    leaf.remove();
  }
};

// Recursively traverses and finds leaf elements and adds them to leaves
DOMFilter._filterLeafElementsVisit = function(leaves, bodyElement, element) {
  const isLeaf = DOMFilter._filterLeafElementsIsLeaf;
  const visit = DOMFilter._filterLeafElementsVisit;
  const childNodes = element.childNodes;
  const childNodeCount = childNodes.length;
  for(let i = 0, cursor; i < childNodeCount; i++) {
    cursor = childNodes[i];
    if(cursor.nodeType === Node.ELEMENT_NODE) {
      if(isLeaf(bodyElement, cursor)) {
        leaves.add(cursor);
      } else {
        visit(leaves, bodyElement, cursor);
      }
    }
  }
};

// Returns true if the given element is a leaf
// TODO: i don't like that bodyElement is a parameter
// TODO: i think this function could just be named isLeaf?
DOMFilter._filterLeafElementsIsLeaf = function(bodyElement, element) {
  if(element === bodyElement) {
    return false;
  }

  if(DOMFilter.LEAF_EXCEPTION_ELEMENT_NAMES.has(element.localName)) {
    return false;
  }

  const isLeaf = DOMFilter._filterLeafElementsIsLeaf;
  const trivialSet = DOMFilter.LEAF_TRIVIAL_TEXT_NODE_VALUES;
  const childNodes = element.childNodes;
  const childCount = childNodes.length;
  for(let i = 0, child; i < childCount; i++) {
    child = childNodes[i];
    if(child.nodeType === Node.TEXT_NODE) {
      if(!trivialSet.has(child.nodeValue)) {
        return false;
      }
    } else if(child.nodeType === Node.ELEMENT_NODE) {
      if(!isLeaf(bodyElement, child)) {
        return false;
      }
    } else {
      return false;
    }
  }

  return true;
};

// Unwraps anchors that are not links to other pages
// Requires: /dom/dom-module.js
DOMFilter.filterNominalAnchors = function(document) {
  const anchors = document.querySelectorAll('a');
  const numAnchors = anchors.length;
  for(let i = 0, anchor, href; i < numAnchors; i++) {
    anchor = anchors[i];
    if(!anchor.hasAttribute('name')) {
      href = anchor.getAttribute('href') || '';
      href = href.trim();
      if(!href) {
        DOMFilter.unwrapElement(anchor);
      }
    }
  }
};

DOMFilter.filterScriptElements = function(document) {
  DOMFilter.removeElementsBySelector(document, 'script');
};

// NOTE: Due to content-loading tricks, noscript requires special handling
// e.g. nbcnews.com. I was originally unwrapping noscripts but it was
// leading to lots of garbage content. For now I am just removing until
// I give this more thought.
DOMFilter.filterNoScriptElements = function(document) {
  DOMFilter.removeElementsBySelector(document, 'noscript');
};

// Disable anchors that use javascript protocol. Keep the href
// around for boilerplate analysis, and because I am not quite sure I want
// remove content beneath such anchors.
// NOTE: rather than use a regex, we can take advantage of the accurate
// parsing of the browser (and mirror its behavior for that matter) by
// just accessing the protocol property.
DOMFilter.filterJavascriptAnchors = function(document) {
  const anchors = document.querySelectorAll('a[href]');
  const numAnchors = anchors.length;
  for(let i = 0, anchors; i < numAnchors; i++) {
    anchor = anchors[i];
    if(anchor.protocol === 'javascript:') {
      anchor.setAttribute('href', '');
    }
  }
};

DOMFilter.filterSingleCellTables = function(document) {

  // NOTE: this check is a guard left over from an old approach and
  // may no longer be necessary
  if(!document.body) {
    return;
  }

  const tables = document.body.querySelectorAll('table');
  for(let i = 0, len = tables.length, table, cell; i < len; i++) {
    table = tables[i];
    cell = DOMFilter.getTableSingleCell(table);
    if(cell) {
      DOMFilter.unwrapSingleCellTable(table, cell);
    }
  }
};

// Returns the single cell of a table iff it is a single cell table,
// which means it has only 1 row and 1 column
DOMFilter.getTableSingleCell = function(table) {
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
// TODO: does HTMLTDElement have a pointer to its container table?
DOMFilter.unwrapSingleCellTable = function(table, cell) {
  const parent = table.parentElement;
  const nextSibling = table.nextSibling;

  if(nextSibling) {
    for(let node = cell.firstChild; node; node = cell.firstChild) {
      parent.insertBefore(node, nextSibling);
    }
  } else {
    for(let node = cell.firstChild; node; node = cell.firstChild) {
      parent.appendChild(node);
    }
  }

  table.remove();
};

DOMFilter.filterSingleColumnTables = function(document) {
  const tables = document.querySelectorAll('table');
  const numTables = tables.length;
  for(let i = 0, table; i < numTables; i++) {
    table = tables[i];
    if(DOMFilter.isSingleColumnTable(table)) {
      DOMFilter.transformSingleColumnTable(table);
    }
  }
};

// Returns true if the table appears to consist of only a single column
DOMFilter.isSingleColumnTable = function(table) {
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

// TODO: create and use a TableCellIterator instead of express iteration?
// TODO: test
DOMFilter.transformSingleColumnTable = function(table) {
  const parent = table.parentElement;
  const nextSibling = table.nextSibling;

  function insert(node, beforeNode) {
    parent.insertBefore(node, beforeNode);
  }

  function append(node) {
    parent.appendChild(node);
  }

  const moveNode = nextSibling ? insert : append;

  const ownerDocument = table.ownerDocument;
  for(let rows = table.rows, numRows = rows.length, rowIndex = 0,
    columnIndex = 0, cell, cells, numCells = 0, firstChild; rowIndex < numRows;
    rowIndex++) {
    for(columnIndex = 0, cells = rows[rowIndex], numCells = cells.length;
      columnIndex < numCells; columnIndex++) {
      for(cell = cells[columnIndex], firstChild = cell.firstChild; firstChild;
        firstChild = cell.firstChild) {
        moveNode(firstChild, nextSibling);
      }
    }

    moveNode(ownerDocument.createElement('p'), nextSibling);
  }

  table.remove();
};


// TODO: this contains some experimental code I don't think I ended up
// using, it should be deleted
// TODO: it may be important to consider the unwrap parent. for example,
// what if this is unwrapping the content into another element that
// should not contain it, like as an immediate child of <table> or
// something like that.
// TODO: focusing on orthogonality, or factoring of features, i think
// that unwrapList and unwrapTable should probably all be merged into
// the general unwrap element function, somehow? Or maybe not, look at
// what I did in filter-single-column-tables regarding moveOperation.
// In order to do this for list, i think i want to pass in the LI, and have
// unwrap find the parent. similarly, for table, i want to pass in the
// the cell, and have unwrap find the container table.
// notably this has the side benefit of avoiding some of the work
// i do below, of re-finding the target child in each of the unwrappers
// TODO: i don't like the check for document.body in this call, it smells,
// think about whose responsibility it is, or maybe do not use document.body
// anyhwere (use querySelectorAll on document)
DOMFilter.filterSingleItemLists = function(document) {

  if(!document.body) {
    return;
  }

  const elements = document.body.querySelectorAll('ul');
  let children = null;
  for(let i = 0, len = elements.length, list; i < len; i++) {
    list = elements[i];
    //children = getListItems(list);
    //if(children.length === 1) {
    //  unwrapListItem(children[0]);
    //}

    if(DOMFilter.countListItems(list) === 1) {
      DOMFilter.unwrapSingleItemList(list);
    }
  }
};

DOMFilter.getListItems = function(list) {
  return Array.prototype.filter.call(list.childNodes, DOMFilter.isListItem);
};

// TODO: childNodes returns nodes, make sure this is the proper test?
DOMFilter.isListItem = function(node) {
  return node.localName === 'li';
};

// TODO: this is generating an intermediate array, that just
// feels wrong, so use an imperative loop instead?
DOMFilter.countListItems = function(list) {
  return Array.prototype.filter.call(list.childNodes,
    DOMFilter.isListItem).length;
};

DOMFilter.getFirstListItem = function(list) {
  for(let i = 0, nodes = list.childNodes, len = nodes.length, node;
    i < len; i++) {
    node = nodes[i];
    if(DOMFilter.isListItem(node)) {
      return node;
    }
  }
};

// Finds the parent of an <LI>. Returns undefined if not found.
DOMFilter.getListItemListParent = function(listItem) {
  let parent = listItem.parentElement;
  while(parent) {
    if(parent.localName === 'ul' || parent.localName === 'ol') {
      return parent;
    }

    parent = parent.parentElement;
  }
};


// TODO: actually, the problem is that we are unwrapping the
// list, not just the list item. this is now semantically misleading.
DOMFilter.unwrapListItem = function(listItem) {
  const list = getListItemListParent(listItem);

  let parent = null, nextSibling = null;

  if(list) {
    parent = list.parentElement;
    nextSibling = list.nextSibling;
  } else {
    parent = listItem.parentElement;
    // ??? TODO what do we point too?
    nextSibling = null;
  }

  // TODO: now unwrap
  // don't forget to remove the list and list item
};


// assumes the list item count > 0
DOMFilter.unwrapSingleItemList = function(list) {
  const parent = list.parentElement;
  const item = DOMFilter.getFirstListItem(list);
  const nextSibling = list.nextSibling;
  if(nextSibling) {
    while(item.firstChild) {
      parent.insertBefore(item.firstChild, nextSibling);
    }
  } else {
    while(item.firstChild) {
      parent.appendChild(item.firstChild);
    }
  }

  list.remove();
};

// Removes images without a source. This should only be called after
// transformLazyImages because that function may derive a source property for
// an otherwise sourceless image.
// NOTE: we use querySelectorAll because we are mutating while iterating
// forward
// NOTE: using hasAttribute allows for whitespace-only values, but I do not
// think this is too important
// NOTE: access by attribute, not by property, because the browser may
// supply a base url prefix or something like that to the property
// TODO: use for..of once Chrome supports iterable NodeLists
// TODO: eventually stop logging. For now it helps as a way to
// identify new lazily-loaded images
DOMFilter.filterSourcelessImages = function(document) {
  const images = document.querySelectorAll('img');
  const numImages = images.length;
  for(let i = 0, image; i < numImages; i++) {
    image = images[i];
    if(!image.hasAttribute('src') && !image.hasAttribute('srcset')) {
      console.debug('Removing sourceless image: %s', image.outerHTML);
      image.remove();
    }
  }
};

// Removes images that do not have a source url or that appear to be tracers.
// A tracer image is a tracking technique where some websites embed a small,
// hidden image into a document and then track the requests for that image
// using a traditional web request log analytics tool. This function considers
// width and height independently, resulting in removal of images that appear
// like horizontal rule elements or vertical bars, which is also desired.
// TODO: this only deals with images, no need to be more abstract, rename
// to filterTracerImages
// NOTE: this assumes that images without explicit dimensions were pre-analyzed
// by setImageDimensions. If there is a simple way to check if an image's
// dimensions are not set, maybe this disambiguates what image.width=0 means.
DOMFilter.filterTracerElements = function(document) {
  const images = document.querySelectorAll('img');
  const numImages = images.length;
  for(let i = 0, image; i < numImages; i++) {
    image = images[i];
    if(image.width < 2 || image.height < 2) {
      image.remove();
    }
  }
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
// TODO: use for..of once Chrome supports NodeList iterators
// @param source {Document}
// @param destination {Document}
// @param selector {String}
// @returns void
DOMFilter.moveElementsBySelector = function(source, destination, selector) {
  const elements = source.querySelectorAll(selector);
  const numElements = elements.length;

  // TODO: do not mutate arguments (as a convention), and to avoid a possible
  // de-opt
  destination = destination || document.implementation.createHTMLDocument();

  for(let i = 0, element; i < numElements; i++) {
    element = elements[i];
    if(element.ownerDocument === source) {
      destination.adoptNode(element);
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
// TODO: use for..of once Chrome supports NodeList iterators
DOMFilter.removeElementsBySelector = function(document, selector) {
  const elements = document.querySelectorAll(selector);
  const numElements = elements.length;
  for(let i = 0; i < numElements; i++) {
    elements[i].remove();
  }
};

// Normalizes the values of all text nodes in a document
// NOTE: this should not be confused with Node.prototype.normalize
// TODO: condense consecutive whitespace?
// TODO: this would have to only occur in non-whitespace sensitive context
//value = value.replace(/[ ]{2,}/g, ' ');
DOMFilter.normalizeNodeWhitespace = function(document) {
  const TRIVIAL_VALUES = new Set([
    '\n', '\n\t', '\n\t\t'
  ]);

  const NBSP_PATTERN = /&nbsp;/g;
  const iterator = document.createNodeIterator(document.documentElement,
    NodeFilter.SHOW_TEXT);
  let node = iterator.nextNode();
  while(node) {
    let value = node.nodeValue;
    if(!TRIVIAL_VALUES.has(value)) {
      value = value.replace(NBSP_PATTERN, ' ');
      node.nodeValue = value;
    }
    node = iterator.nextNode();
  }
};

// Removes trimmable elements from the start and end of the document
// NOTE: should isTrimmableElement be merged or share functionality with
// the isLeaf function?
DOMFilter.trimDocument = function(document) {
  const root = document.body;

  if(!root) {
    return;
  }

  let sibling = root;
  let node = root.firstChild;
  while(DOMFilter.isTrimmableElement(node)) {
    sibling = node.nextSibling;
    node.remove();
    node = sibling;
  }

  node = root.lastChild;
  while(DOMFilter.isTrimmableElement(node)) {
    sibling = node.previousSibling;
    node.remove();
    node = sibling;
  }
};

DOMFilter.isTrimmableElement = function(element) {
  const ELEMENT_NODE = Node.ELEMENT_NODE;
  if(!element) return false;
  if(element.nodeType !== ELEMENT_NODE) return false;
  let name = element.localName;
  if(name === 'br') return true;
  if(name === 'hr') return true;
  if(name === 'p' && !element.firstChild) return true;
  return false;
};


// Carefully trims a document's text nodes, with special handling for
// nodes near inline elements and whitespace sensitive elements such as <pre>
// TODO: this is still causing an issue where there is no space adjacent
// to an inline element, e.g. a<em>b</em> is rendered as ab

// TODO: i am still observing trim errors in the output that I attribute to
// this function, so something is still wrong with it, requires testing
// of specific cases
DOMFilter.trimTextNodes = function(document) {
  const sensitives = DOMFilter.getSensitiveSet(document);
  const iterator = document.createNodeIterator(
    document.documentElement, NodeFilter.SHOW_TEXT);
  const isElement = DOMFilter.isElement;
  const isInlineElement = DOMFilter.isInlineElement;
  let node = iterator.nextNode();
  while(node) {

    if(sensitives.has(node.parentElement)) {
      node = iterator.nextNode();
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

    if(!node.nodeValue) {
      node.remove();
    }

    node = iterator.nextNode();
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

// Return a set of elements that are whitespace sensitive
DOMFilter.getSensitiveSet = function(document) {
  const elements = document.querySelectorAll(
    DOMFilter.SENSITIVE_ELEMENTS_SELECTOR);
  return new Set(Array.from(elements));
};

// TODO: merge with inline elements above?
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

DOMFilter.isInlineElement = function(element) {
  return DOMFilter.INLINE_ELEMENTS_NO_TRIM.has(element.localName);
};

DOMFilter.isElement = function(node) {
  return node.nodeType === Node.ELEMENT_NODE;
};

// Replaces an element with its child nodes
// TODO: not optimized for live documents, redesign so that this uses fewer
// dom operations, maybe use a DocumentFragment
// TODO: do additional research into whether there is some native method that
// provides sufficiently similar functionality.
// TODO: should I be removing parentless elements anyway? move element.remove
// outside of the if block?
// TODO: i recently noticed jQuery provides some kind of unwrap function,
// look into it more and compare it to this
DOMFilter.unwrapElement = function(element) {
  const parent = element.parentElement;
  if(parent) {
    let firstNode = element.firstChild;
    while(firstNode) {
      parent.insertBefore(firstNode, element);
      firstNode = element.firstChild;
    }
    element.remove();
  }
};
