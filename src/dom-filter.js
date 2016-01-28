// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

// TODO: avoid global strict mode, maybe use an IIFE?
// TODO: look into http://www.streamjs.org/ for a NodeStream concept?

'use strict';

const DOMFilter = {};

// Creates an iterator object for a node list so that it can be traversed using
// for..of, because NodeList currently does not support that syntax. This is
// merely a placeholder for that idea.
DOMFilter.createNodeListIterator = function(nodeList) {
  throw new Error('Not implemented');
};

DOMFilter.elementHasName = function(name, element) {
  return element.localName === name;
};

// No longer in use, will delete eventually
//DOMFilter.isFigureElement = DOMFilter.elementHasName.bind(null, 'figure');

// Finds the associated caption for an image
// NOTE: Requires Element.prototype.closest
DOMFilter.findImageCaption = function(image) {
  const figure = image.closest('figure');
  return figure ? figure.querySelector('figcaption') : null;
};

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
DOMFilter.filterBreakruleElements = function(document) {
  const elements = document.querySelectorAll('br');
  const numElements = elements.length;
  for(let i = 0, element, parent, p; i < numElements; i++) {
    element = elements[i];
    parent = element.parentElement;
    p = document.createElement('p');
    parent.replaceChild(p, element);
  }
};

// Removes certain attributes from all elements in the document
DOMFilter.filterAttributes = function(document) {
  const elements = document.getElementsByTagName('*');
  const numElements = elements.length;
  for(let i = 0; i < numElements; i++) {
    DOMFilter.filterElementAttributes(elements[i]);
  }
};

// Removes certain attributes from an element
DOMFilter.filterElementAttributes = function(element) {

  const elementName = element.localName;

  // Skip SVG
  // TODO: but what about onclick and such? this would be a security hole
  // TODO: leaving in SVG turns out to cause some funky display issues,
  // so this requires more thought. For example, I observed an article where
  // the SVG element was permanently floating in higher layer over the
  // article's actual text, making the article unreadable.
  // TODO: maybe svg and path should just be blacklisted
  // TODO: also, the size is way off this way, because the element isn't
  // bounded to its container
  if(elementName === 'svg' || elementName === 'path') {
    return;
  }

  // NOTE: we iterate in reverse to avoid issues with mutating a live
  // NodeList while iterating
  const attributes = element.attributes || [];
  for(let j = attributes.length - 1, attributeName; j > -1; j--) {
    attributeName = attributes[j].name;
    if(!DOMFilter.isPermittedAttribute(elementName, attributeName)) {
      element.removeAttribute(attributeName);
    }
  }
};

// Returns whether an attribute should not be removed
// TODO: try and preserve more accessibility attributes
// TODO: support media and other embeds
// TODO: this should be implemented to work independently of the element
// blacklist policy. Even though an element may be blacklisted, it should
// still be processed here according to its own attribute policy.
// TODO: review aria handling
// TODO: what about role and other microdata attributes?
DOMFilter.isPermittedAttribute = function(elementName, attributeName) {
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

// Removes hidden elements from a document using a semi-accurate but fast
// approach. This function previously was more accurate and investigated each
// element's style property. However, this resulted in Chrome lazily computing
// each element's style, which resulted in poor performance. Given that we are
// ignoring non-inline styles in the first place, I don't think the loss of
// accuracy is too important. The only real issue is that failing to remove
// such elements could negatively affect boilerplate analysis.
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
// TODO: when unwrapping an inline element, I need to insert a space following
// the contents of the element (e.g. createTextNode(' ')), to avoid things like
// <div><span>text</span>text</div> becoming texttext
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
// Elements that contain only trivial text nodes are still considered leaves,
// such as <p>\n</p>
// TODO: this could still use improvement. it is revisiting and
// re-evaluating children sometimes.
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
  const leafSet = new Set();
  DOMFilter._filterLeafElementsVisit(leafSet, document.body,
    document.documentElement);
  for(let leaf of leafSet) {
    leaf.remove();
  }
};

// Recursively traverses and finds leaf elements and adds them to leaves
// TODO: i would like to do this without recursion for better perf
DOMFilter._filterLeafElementsVisit = function(leaves, bodyElement, element) {
  const childNodes = element.childNodes;
  const numChildNodes = childNodes.length;
  for(let i = 0, cursor; i < numChildNodes; i++) {
    cursor = childNodes[i];
    if(DOMFilter.isElement(cursor)) {
      if(DOMFilter._filterLeafElementsIsLeaf(bodyElement, cursor)) {
        leaves.add(cursor);
      } else {
        DOMFilter._filterLeafElementsVisit(leaves, bodyElement, cursor);
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

  const childNodes = element.childNodes;
  const numChildNodes = childNodes.length;
  for(let i = 0, child; i < numChildNodes; i++) {
    child = childNodes[i];
    if(child.nodeType === Node.TEXT_NODE) {
      if(!DOMFilter.TRIVIAL_TEXT_NODE_VALUES.has(child.nodeValue)) {
        return false;
      }
    } else if(DOMFilter.isElement(child)) {
      if(!DOMFilter._filterLeafElementsIsLeaf(bodyElement, child)) {
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

DOMFilter.isNominalAnchor = function(anchor) {
  // todo: implement me
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
DOMFilter.filterJavascriptAnchors = function(document) {
  const anchors = document.querySelectorAll('a[href]');
  const numAnchors = anchors.length;
  for(let i = 0, anchor; i < numAnchors; i++) {
    anchor = anchors[i];
    if(DOMFilter.isJavascriptAnchor(anchor)) {
      anchor.setAttribute('href', '');
    }
  }
};

// NOTE: rather than use a regex, we can take advantage of the accurate
// parsing of the browser (and mirror its behavior for that matter) by
// just accessing the protocol property.
DOMFilter.isJavascriptAnchor = function(anchor) {
  return anchor.protocol === 'javascript:';
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
// change document.body.qsa to document.qsa?
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
// TODO: use for..of once Chrome supports iterable NodeLists
// TODO: eventually stop logging. For now it helps as a way to
// identify new lazily-loaded images
DOMFilter.filterSourcelessImages = function(document) {
  const images = document.querySelectorAll('img');
  const numImages = images.length;
  for(let i = 0, image; i < numImages; i++) {
    image = images[i];
    if(DOMFilter.isSourcelessImage(image)) {
      console.debug('Removing sourceless image: %s', image.outerHTML);
      image.remove();
    }
  }
};

// NOTE: using hasAttribute allows for whitespace-only values, but I do not
// think this is too important
// NOTE: access by attribute, not by property, because the browser may
// supply a base url prefix or something like that to the property
DOMFilter.isSourcelessImage = function(image) {
  return !image.hasAttribute('src') && !image.hasAttribute('srcset');
};

// Removes stat-tracking images
DOMFilter.filterTracerImages = function(document) {
  const images = document.querySelectorAll('img');
  const numImages = images.length;
  for(let i = 0, image; i < numImages; i++) {
    image = images[i];
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
// TODO: use for..of once Chrome supports NodeList iterators
// @param source {Document}
// @param destination {Document}
// @param selector {String}
// @returns void
DOMFilter.moveElementsBySelector = function(source, destination, selector) {
  const elements = source.querySelectorAll(selector);
  const numElements = elements.length;
  const targetDocument = destination ||
    document.implementation.createHTMLDocument();
  for(let i = 0, element; i < numElements; i++) {
    element = elements[i];
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

DOMFilter.manipulateElementsBySelectorAndPredicate = function(document,
  selector, predicate, manipulate) {

  const elements = document.querySelectorAll(selector);
  const numElements = elements.length;
  for(let i = 0, element; i < numElements; i++) {
    element = elements[i];
    if(predicate(element)) {
      manipulate(element);
    }
  }
};

DOMFilter.rejectTrivialTextNodeValues = function(node) {
  return DOMFilter.TRIVIAL_TEXT_NODE_VALUES.has(node.nodeValue) ?
    NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT;
};

DOMFilter.NBSP_PATTERN = /&nbsp;/g;

// Normalizes the values of all text nodes in a document
DOMFilter.normalizeWhitespace = function(document) {
  const iterator = document.createNodeIterator(document.documentElement,
    NodeFilter.SHOW_TEXT, DOMFilter.rejectTrivialTextNodeValues);
  for(let node = iterator.nextNode(); node; node = iterator.nextNode()) {
    node.nodeValue = node.nodeValue.replace(DOMFilter.NBSP_PATTERN, ' ');
  }
};

// Condenses spaces of text nodes that are not descendants of whitespace
// sensitive elements such as <pre>. This expects that node values were
// previous normalized, so, for example, it does not consider &nbsp;.
DOMFilter.condenseNodeValues = function(document, sensitiveElements) {
  const iterator = document.createNodeIterator(document.documentElement,
    NodeFilter.SHOW_TEXT,
    DOMFilter.rejectIfSensitive.bind(null, sensitiveElements));
  for(let node = iterator.nextNode(); node; node = iterator.nextNode()) {
    node.nodeValue = DOMFilter.condenseSpaces(node.nodeValue);
  }
};

DOMFilter.rejectIfSensitive = function(sensitiveElements, node) {
  return sensitiveElements.has(node.parentElement) ?
    NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT;
};

// A regular expression that matches any number of occurrences of one or more
// consecutive spaces
DOMFilter.CONSECUTIVE_SPACES_PATTERN = / +/g;

// Replaces one or more consecutive spaces with a single space
DOMFilter.condenseSpaces = function(inputString) {
  return inputString.replace(DOMFilter.CONSECUTIVE_SPACES_PATTERN, ' ');
};

// Removes trimmable elements from the start and end of the document
// NOTE: should isTrimmableElement be merged or share functionality with
// the isLeafElement function?
// NOTE: should only be called after filterLeafElements if that is ever called
DOMFilter.trimDocument = function(document) {
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

// TODO: support additional cases of empty elements other than paragraph? we
// basically want to consider every element except for img, svg, etc.
// TODO: review interaction with removal of empty node values, does that
// still happen anywhere? if a node value that is empty remains then
// the empty paragraph check or other similar checks, will not work if such
// checks only look at the presence of a child node, i think i do this
// implicitly as a part of trimTextNodes, maybe that should be separated out
// TODO: review interaction with filterLeafElements, won't the removal of
// all empty paragraphs already consider this? but then trimming would have
// to occur after leaves removed, right? should order matter?
DOMFilter.isTrimmableNode = function(node) {
  return DOMFilter.isElement(node) &&
    (DOMFilter.TRIMMABLE_NODE_NAMES.has(node.localName) ||
    DOMFilter.isEmptyParagraph(node));
};

DOMFilter.isEmptyParagraph = function(element) {
  return element && element.localName === 'p' && !element.firstChild;
};

// Carefully trims a document's text nodes, with special handling for
// nodes near inline elements and whitespace sensitive elements such as <pre>
// TODO: this is still causing an issue where there is no space adjacent
// to an inline element, e.g. a<em>b</em> is rendered as ab
// TODO: i am still observing errors in the output that I attribute to
// this function
DOMFilter.trimTextNodes = function(document, sensitiveElements) {
  const iterator = document.createNodeIterator(
    document.documentElement, NodeFilter.SHOW_TEXT,
    DOMFilter.rejectIfSensitive.bind(null, sensitiveElements));
  const isElement = DOMFilter.isElement;
  const isInlineElement = DOMFilter.isInlineElement;
  let node = iterator.nextNode();
  while(node) {
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

    node = iterator.nextNode();
  }
};

DOMFilter.filterEmptyTextNodes = function(document) {
  const iterator = document.createNodeIterator(
    document.documentElement, NodeFilter.SHOW_TEXT);
  for(let node = iterator.nextNode(); node; node = iterator.nextNode()) {
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
// TODO: see if I can avoid Array.from once Chrome supports iterable NodeLists
DOMFilter.getSensitiveSet = function(document) {
  const sensitiveElements = document.querySelectorAll(
    DOMFilter.SENSITIVE_ELEMENTS_SELECTOR);
  return new Set(Array.from(sensitiveElements));
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
