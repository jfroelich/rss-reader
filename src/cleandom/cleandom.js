// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

// Walks the document and appends a no referrer attribute to anchors.
// TODO: document the effect of doing this
function addNoReferrerToAnchors(document) {
  const anchors = document.querySelectorAll('a');
  for(let anchor of anchors) {
    anchor.setAttribute('rel', 'noreferrer');
  }
}


{ // Begin block scope

// NOTE: the list of elements is incomplete, but I am hesitant to expand. I
// think it is good enough for now.
const BLOCK_ELEMENTS = ['blockquote', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p'];
const BLOCK_SELECTOR = BLOCK_ELEMENTS.join(',');

// The Element.prototype.closest function expects lowercase element names,
// at least that is why I got when testing. So make sure never to use uppercase
// names here, or do some more testing.
const INLINE_ELEMENTS = ['a'];
const INLINE_SELECTOR = INLINE_ELEMENTS.join(',');

// Looks for cases such as <a><p>text</p></a> and transforms them into
// <p><a>text</a></p>.
// NOTE: this currently does not consider ...<a><a><p></p></a></a>... and
// similar cases. This only looks at the closest inline ancestor. However I
// don't think it is too important to achieve perfect accuracy here. This is
// simply an attempt to reduce some ugliness in the view.
function adjustBlockInlineElements(document) {
  const blocks = document.querySelectorAll(BLOCK_SELECTOR);
  const numBlocks = blocks.length;
  // Not using for..of due to V8 deopt warning about try/catch

  for(let i = 0; i < numBlocks; i++) {
    const block = blocks[i];
    const ancestor = block.closest(INLINE_SELECTOR);
    if(ancestor && ancestor.parentNode) {
      // Move the block to before the ancestor
      ancestor.parentNode.insertBefore(block, ancestor);

      // Move the block's children into the ancestor.
      for(let node = block.firstChild; node; node = block.firstChild) {
        ancestor.appendChild(node);
      }

      // Move the ancestor into the block
      block.appendChild(ancestor);
    }
  }
}

this.adjustBlockInlineElements = adjustBlockInlineElements;

} // End block scope

{ // Begin block scope

// NOTE: perf testing showed that querying the ancestors per node is faster
// than generating a set of descendants of sensitive nodes and checking
// membership
const SELECTOR = ['code', 'pre', 'ruby', 'textarea', 'xmp'].join(',');

function condenseTextNodeWhitespace(doc) {
  const it = doc.createNodeIterator(doc.documentElement, NodeFilter.SHOW_TEXT);
  for(let node = it.nextNode(); node; node = it.nextNode()) {

    // Note that accessing node value partially decodes (or is it encodes)
    // the raw node value.
    // TODO: double check this, this may be why this function matches so little
    // whitespace.
    const value = node.nodeValue;

    // The length check reduces calls to closest which is expensive.
    // closest is not defined on text nodes, only elements, so use parentNode
    // parentNode is guaranteed defined for text nodes and is always an element
    // closest is self-inclusive so this still works for immediate children
    // Not using an idiomatic function call due to perf
    if(value.length > 3 && !node.parentNode.closest(SELECTOR)) {

      // This is not an idiomatic function call due to perf. This regex looks
      // for two or more whitespace characters and replaces them with a single
      // space.
      // TODO: do I want to restrict this to actual spaces and not all
      // whitespace? \s matches a ton of entities.
      let condensedValue = value.replace(/\s{2,}/g, ' ');

      // Setting node value can be expensive so try and avoid it
      if(condensedValue !== value) {
        node.nodeValue = condensedValue;
      }
    }
  }
}

this.condenseTextNodeWhitespace = condenseTextNodeWhitespace;

} // End block scope


// Transform anchors that contain inline script or only serve a formatting role.
// An anchor is a formatting anchor when it serves no other role than being a
// container. In this context, where formatting information is ignored, it is
// useless.
// TODO: rename to something like filterAnchors
function filterAnchorElements(document) {
  const anchors = document.querySelectorAll('a');
  for(let i = 0, len = anchors.length; i < len; i++) {
    const anchor = anchors[i];
    const href = anchor.getAttribute('href');
    if(!href && !anchor.hasAttribute('name')) {
      unwrapElement(anchor);
    } else if(href && href.length > 11 && /^\s*javascript:/i.test(href)) {
      unwrapElement(anchor);
    }
  }
}


// Removes blacklisted elements from the document.
// This uses a blacklist approach instead of a whitelist because of issues
// with custom html elements. If I used a whitelist approach, any element
// not in the whitelist would be removed. The problem is that custom elements
// wouldn't be in the whitelist, but they easily contain valuable content.
// TODO: use file block scope, declare elements in outer scope
function filterBlacklistedElements(document) {

  const ELEMENTS = [
    'APPLET', 'AUDIO', 'BASE', 'BASEFONT', 'BGSOUND', 'BUTTON', 'COMMAND',
    'DATALIST', 'DIALOG', 'EMBED', 'FIELDSET', 'FRAME', 'FRAMESET', 'HEAD',
    'IFRAME', 'INPUT', 'ISINDEX', 'LINK', 'MATH', 'META',
    'OBJECT', 'OUTPUT', 'OPTGROUP', 'OPTION', 'PARAM', 'PATH', 'PROGRESS',
    'SCRIPT', 'SELECT', 'SPACER', 'STYLE', 'SVG', 'TEXTAREA', 'TITLE',
    'VIDEO', 'XMP'
  ];
  const SELECTOR = ELEMENTS.join(',');

  // check contains to try and reduce the number of remove calls

  const docEl = document.documentElement;
  const elements = document.querySelectorAll(SELECTOR);
  for(let i = 0, len = elements.length; i < len; i++) {
    let element = elements[i];
    if(docEl.contains(element)) {
      element.remove();
    }
  }
}

function filterBRElements(document) {
  const elements = document.querySelectorAll('br + br');
  for(let i = 0, len = elements.length; i < len; i++) {
    elements[i].remove();
  }
}

function filterCommentNodes(doc) {
  const it = doc.createNodeIterator(doc.documentElement,
    NodeFilter.SHOW_COMMENT);
  for(let node = it.nextNode(); node; node = it.nextNode()) {
    node.remove();
  }
}


// Removes most attributes from elements using a per element whitelist
// TODO: make less dry, maybe add helpers
// TODO: removeAttribute just does a lookup of the attribute again. Look
// into whether there is a simple way to remove an attribute if I already
// have the attribute node object.
// TODO: use element.localName and lowercase comparison tests
function filterElementAttributes(document) {

  // Use getElementsByTagName here over querySelectorAll because we are not
  // removing elements from the HTMLCollection and get a marginal perf benefit
  const elements = document.getElementsByTagName('*');

  // element.attributes yields a live NodeList. Therefore each attribute removal
  // shortens the list. If we cache the length of the list upfront, then we
  // could iterate past the end of the list as we iterate. Therefore, iterate
  // in reverse to avoid the issue.

  for(let i = 0, len = elements.length; i < len; i++) {
    let element = elements[i];
    let elementName = element.nodeName;
    let attributes = element.attributes;
    if(!attributes || !attributes.length) {
      continue;
    }

    if(elementName === 'SOURCE') {
      for(let j = attributes.length - 1; j > -1; j--) {
        let attributeName = attributes[j].name;
        if(attributeName !== 'type' && attributeName !== 'srcset' &&
          attributeName !== 'sizes' && attributeName !== 'media' &&
          attributeName !== 'src') {
          element.removeAttribute(attributeName);
        }
      }
    } else if(elementName === 'A') {
      for(let j = attributes.length - 1; j > -1; j--) {
        let attributeName = attributes[j].name;
        if(attributeName !== 'href' && attributeName !== 'name' &&
          attributeName !== 'title') {
          element.removeAttribute(attributeName);
        }
      }
    } else if(elementName === 'IFRAME') {
      for(let j = attributes.length - 1; j > -1; j--) {
        let attributeName = attributes[j].name;
        if(attributeName !== 'src') {
          element.removeAttribute(attributeName);
        }
      }
    } else if(elementName === 'IMG') {
      for(let j = attributes.length - 1; j > -1; j--) {
        let attributeName = attributes[j].name;
        if(attributeName !== 'src' && attributeName !== 'alt' &&
          attributeName !== 'srcset' && attributeName !== 'title') {
          element.removeAttribute(attributeName);
        }
      }
    } else {
      for(let j = attributes.length - 1; j > -1; j--) {
        element.removeAttribute(attributes[j].name);
      }
    }
  }
}

{ // Begin block scope

const HIDDEN_SELECTOR = [
  '[style*="display:none"]',
  '[style*="display: none"]',
  '[style*="visibility:hidden"]',
  '[style*="visibility: hidden"]',
  '[style*="opacity: 0.0"]',
  '[aria-hidden="true"]'
].join(',');

// Filters some hidden elements from a document. This is designed for speed,
// not accuracy. This does not check element.style due to performance issues.
// The contains check avoids removing nodes in detached subtrees. Elements are
// unwrapped instead of specifically removed to avoid removing valuable
// content in the case of documents wrapped in a hidden div or similar.
function filterHiddenElements(doc) {
  const elements = doc.querySelectorAll(HIDDEN_SELECTOR);
  const docElement = doc.documentElement;

  // Not using for..of due to V8 deopt warning about try/catch
  // Check not doc el because its not possible to unwrap the doc el but that
  // check is not made by unwrap.
  for(let i = 0, len = elements.length; i < len; i++) {
    const element = elements[i];
    if(element !== docElement && docElement.contains(element)) {
      unwrapElement(element);
    }
  }
}

this.filterHiddenElements = filterHiddenElements;

} // End block scope

{ // Begin block scope

const SELECTOR = [
  'hr + hr', // consecutive hrs
  'ul > hr', // hierarchy error
  'ol > hr' // hierarchy error
].join(',');

function filterHRElements(document) {
  const elements = document.querySelectorAll(SELECTOR);
  for(let i = 0, len = elements.length; i < len; i++) {
    elements[i].remove();
  }
}

this.filterHRElements = filterHRElements;

} // End block scope


// TODO: break apart into two functions that declare exactly what they do
// - note that filter-sourceless-images already exists
// TODO: rename to filterImages
function filterImageElements(document) {
  const images = document.querySelectorAll('img');
  for(let i = 0, len = images.length; i < len; i++) {
    let img = images[i];

    // Note the difference between an image without a certain attribute and an
    // image with the attribute but its value is empty or only whitespace. I am
    // sacrificing some accuracy in return for better speed.

    if(!img.hasAttribute('src') && !img.hasAttribute('srcset')) {
      img.remove();
    } else if(img.width < 2 || img.height < 2) {
      img.remove();
    }
  }
}

{ // Begin block scope

// Filters various anchors from the document.
// @param doc {Document}
// TODO: should this be unwrapping instead of removing?
function filterInvalidAnchors(doc) {
  const anchors = doc.querySelectorAll('a');
  for(let anchor of anchors) {
    if(isInvalidAnchor(anchor)) {
      anchor.remove();
    }
  }
}

// Eventually this could look for other invalid patterns, but currently I am
// only focusing on one. I think it is related to a Macromedia template.
function isInvalidAnchor(anchor) {
  console.assert(anchor);
  const href = anchor.getAttribute('href');
  return href && /^\s*https?:\/\/#/i.test(href);
}

this.filterInvalidAnchors = filterInvalidAnchors;

} // End block scope


// Removes leaf-like elements from the document
function filterLeafElements(doc) {

  const body = doc.body;

  // Ensure the body is set. This works within body only to avoid blanking the
  // entire document if body is a leaf. If there is no body then there is
  // nothing to do.
  if(!body) {
    return;
  }

  const docElement = doc.documentElement;
  const elements = body.querySelectorAll('*');

  // Not using for..of due to V8 deopt warning about try/catch

  for(let i = 0, len = elements.length; i < len; i++) {
    let element = elements[i];
    if(docElement.contains(element) && isLeafNode(element)) {
      element.remove();
    }
  }
}


{ // Begin block scope

// @param limit max number of rows to inspect
function filterTableElements(document, limit) {
  const tables = document.querySelectorAll('table');
  for(let i = 0, len = tables.length; i < len; i++) {
    const table = tables[i];
    if(isSingleColTable(table, limit)) {
      unwrapSingleColTable(table);
    }
  }
}

// A table is a single column unless it has any non-single column rows in
// the first couple of rows
function isSingleColTable(table, limit) {
  const rows = table.rows;
  const upper = Math.min(rows.length, limit);
  for(let i = 0; i < upper; i++) {
    if(!isSingleColRow(rows[i])) {
      return false;
    }
  }
  return true;
}

// A row is a single column when it is either empty or contains no more than
// one non-leaf cell.
// TODO: the logic here could be simplified. Maybe just use a boolean
// instead of a counter.
function isSingleColRow(row) {
  const cells = row.cells;
  let nonEmptyCount = 0;
  for(let i = 0, len = cells.length; i < len; i++) {
    const cell = cells[i];
    if(isLeafNode(cell)) {
      // If it is a leaf node, it could still be a single column row element
    } else {
      // If it is a non leaf node, it is no longer a single column row element
      // if this is the 2nd non-leaf found.
      nonEmptyCount++;
      if(nonEmptyCount === 1) {
        // This is the first non-leaf. Still could be single column
      } else {
        // This is the second non-leaf. Can't be single column.
        // console.debug('Not a single column:', row.outerHTML);
        return false;
      }
    }
  }

  return true;
}

// isSingleColTable does not guarantee that all rows are single column, so
// we still iterate all cells per row, even though most of the time this
// is just one cell.
function unwrapSingleColTable(table) {
  const rows = table.rows;
  const numRows = rows.length;
  const tableParent = table.parentNode;

  // TODO: only pad if adjacent to text node

  tableParent.insertBefore(document.createTextNode(' '), table);

  for(let i = 0; i < numRows; i++) {
    const row = rows[i];

    // TODO: if the cell is a leaf node, skip it and do not create
    // a new paragraph.
    for(let k = 0, clen = row.cells.length; k < clen; k++) {
      const cell = row.cells[k];
      insertChildrenBefore(cell, table);
    }

    tableParent.insertBefore(document.createElement('p'), table);
  }

  tableParent.insertBefore(document.createTextNode(' '), table);
  table.remove();
}

this.filterTableElements = filterTableElements;

} // End block scope


{ // Begin block scope

const SELECTOR = [
  'abbr',
  'acronym',
  'article',
  'aside',
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

function filterUnwrappableElements(document) {
  const elements = document.querySelectorAll(SELECTOR);
  for(let i = 0, len = elements.length; i < len; i++) {
    unwrapElement(elements[i]);
  }
}

this.filterUnwrappableElements = filterUnwrappableElements;

} // End block scope

{ // Begin block scope

// TODO: figure out a way to avoid re-trimming text nodes. I feel like the
// bulk of the time is spent doing this.

// Certain elements, typically those that are defined as void elements in the
// spec, can readily appear to be leaves, but should not be considered leaves.
// I am using a plain object instead of a Set for performance.
const EXCEPTIONS = {
  'area': 1, 'audio': 1, 'base': 1, 'col': 1, 'command': 1, 'br': 1,
  'canvas': 1, 'col': 1, 'hr': 1, 'iframe': 1, 'img': 1, 'input': 1,
  'keygen': 1, 'meta': 1, 'nobr': 1, 'param': 1, 'path': 1, 'source': 1,
  'sbg': 1, 'textarea': 1, 'track': 1, 'video': 1, 'wbr': 1
};

// An element is a leaf unless it is a named exception, contains a
// non-whitespace-only text node, or contains at least one non-leaf child
// element. This is a recursive function.
function isLeafNode(node) {
  switch(node.nodeType) {
    case Node.ELEMENT_NODE:
      if(node.localName in EXCEPTIONS) {
        return false;
      }

      for(let child = node.firstChild; child; child = child.nextSibling) {
        if(!isLeafNode(child)) {
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
}

this.isLeafNode = isLeafNode;

} // End block scope

{ // Begin file block scope

// Applies a series of filters to a document. Modifies the document
// in place. The filters are applied in a preset order so as to minimize the
// work done by each sequential step, and to ensure proper handling of
// things like frameset elements.
function sanitizeDocument(doc) {
  filterCommentNodes(doc);
  filterFrames(doc);
  filterNoscripts(doc);
  filterBlacklistedElements(doc);
  filterHiddenElements(doc);
  adjustBlockInlineElements(doc);
  filterBRElements(doc);
  filterAnchorElements(doc);
  filterImageElements(doc);
  filterUnwrappableElements(doc);
  filterFigures(doc);
  filter_hair_spaces(doc);
  condenseTextNodeWhitespace(doc);
  unwrapSingleItemLists(doc);

  const limit = 20;
  filterTableElements(doc, limit);
  filterLeafElements(doc);
  filterHRElements(doc);
  trimDocument(doc);
  filterElementAttributes(doc);
}

// TODO: should be part of some normalize whitespace general function?
function filter_hair_spaces(doc) {
  const it = doc.createNodeIterator(doc.documentElement,
    NodeFilter.SHOW_TEXT);
  for(let node = it.nextNode(); node; node = it.nextNode()) {
    const value = node.nodeValue;
    const modifiedValue = value.replace(/&(hairsp|#8082|#x200a);/ig, ' ');
    if(modifiedValue !== value) {
      console.debug('Replaced hair spaces', value, '=>', modifiedValue);
      node.nodeValue = modifiedValue;
    }
  }
}

// Unwraps <noscript> elements. Although this could be done by
// filterUnwrappableElements, I am doing it here because I consider <noscript>
// to be a special case. This unwraps instead of removes because some documents
// embed the entire content in a noscript tag and then use their own scripted
// unwrapping call to make the content available.
//
// TODO: look into whether I can make a more educated guess about whether
// to unwrap or to remove. For example, maybe if there is only one noscript
// tag found, or if the number of elements outside of the node script but
// within the body is above or below some threshold (which may need to be
// relative to the total number of elements within the body?)
function filterNoscripts(doc) {
  const elements = doc.querySelectorAll('noscript');
  for(let i = 0, len = elements.length; i < len; i++) {
    unwrapElement(elements[i]);
  }
}

// TODO: what if both body and frameset are present?
// TODO: there can be multiple bodies when illformed. Maybe use
// querySelectorAll and handle multi-body branch differently
function filterFrames(doc) {
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
    const error_node = doc.createTextNode(
      'Unable to display framed document.');
    body.appendChild(error_node);
  }

  frameset.remove();
  doc.documentElement.appendChild(body);
}

// If a figure has only one child element, then it is useless.
// NOTE: boilerplate analysis examines figures, so ensure this is not done
// before it.
// TODO: is it actually useless?
function filterFigures(doc) {
  const figures = doc.querySelectorAll('FIGURE');
  for(let i = 0, len = figures.length; i < len; i++) {
    let figure = figures[i];
    if(figure.childElementCount === 1) {
      unwrapElement(figure);
    }
  }
}

this.sanitizeDocument = sanitizeDocument;

} // End block scope

{ // Begin block scope

function trimDocument(document) {
  const body = document.body;
  if(!body) {
    return;
  }

  const firstChild = body.firstChild;
  if(firstChild) {
    step(firstChild, 'nextSibling');
    const lastChild = body.lastChild;
    if(lastChild && lastChild !== firstChild) {
      step(lastChild, 'previousSibling');
    }
  }
}

const TRIMMABLE_ELEMENTS = {
  'br': 1,
  'hr': 1,
  'nobr': 1
};

function isTrimmable(node) {
  return node && (node.localName in TRIMMABLE_ELEMENTS ||
    (node.nodeType === Node.TEXT_NODE && !node.nodeValue.trim()));
}

function step(start_node, prop_name) {
  let node = start_node;
  while(isTrimmable(node)) {
    let sibling = node[prop_name];
    node.remove();
    node = sibling;
  }
}

this.trimDocument = trimDocument;

} // End block scope


// Moves the element's child nodes into the element's parent, preceding the
// element, and then removes the element. If a reference node is defined, this
// instead moves the element's child nodes into the parent of the reference
// node, and then removes the reference node.
// Padding is added around the child nodes to avoid issues with text that
// becomes adjacent as a result of removing the element.
// This is not optimized to work on a live document. The element, and the
// reference node if defined, should be located within an inert document.
function unwrapElement(element, referenceNode) {
  const target = referenceNode || element;
  const parent = target.parentNode;
  console.assert(parent);
  const document = element.ownerDocument;
  const prevSibling = target.previousSibling;
  if(prevSibling && prevSibling.nodeType === Node.TEXT_NODE) {
    parent.insertBefore(document.createTextNode(' '), target);
  }

  insertChildrenBefore(element, target);

  const nextSibling = target.nextSibling;
  if(nextSibling && nextSibling.nodeType === Node.TEXT_NODE) {
    parent.insertBefore(document.createTextNode(' '), target);
  }

  target.remove();
}

// Inserts the children of the parentNode before the reference node
function insertChildrenBefore(parentNode, referenceNode) {
  const referenceParent = referenceNode.parentNode;
  for(let node = parentNode.firstChild; node; node = parentNode.firstChild) {
    referenceParent.insertBefore(node, referenceNode);
  }
}


{ // Begin block scope

const LIST_SELECTOR = 'ul, ol, dl';
// TODO: should i restrict test for dd to only in dl? maybe it's not too
// important

// Not using Set due to performance issues. Although maybe it is worth
// experimenting again
const ITEM_NAMES = {'li': 1, 'dt': 1, 'dd': 1};

// Scans for lists in the document that contain only a single item and then
// replaces a list with the contents of its one item. Whitespace is added to
// avoid normalization of adjacent text nodes.
function unwrapSingleItemLists(document) {
  const lists = document.querySelectorAll(LIST_SELECTOR);
  // Not using for..of to iterate over lists variable due to V8 deopt warning
  for(let i = 0, len = lists.length; i < len; i++) {
    unwrapSingleItemList(document, lists[i]);
  }
}

// TODO: technically lists could have things like <form> and such, maybe
// what I want to do is instead use list.querySelectorAll(items)? But that is
// not restricted to immediate children, which specifically means it would be
// wrong when the list contains other lists. So I would have to do an explicit
// walk somehow of all descendants not in other list items. Right now I am just
// going to leave this as an unsupported case. I suppose what I could do is look
// into how the browser identifies child items of a list.
function unwrapSingleItemList(document, list) {

  // Scan to and get the first child element
  const item = list.firstElementChild;

  // Ignore lists without items.
  // TODO: i suppose I could eventually remove such lists but that is not
  // currently this function's responsibility
  if(!item) {
    return;
  }

  // If the first child element has a sibling, then this cannot be a single item
  // list
  // TODO: maybe I could use nextSibling here? it would cover the pathological
  // case of <ul><li></li>outofplace</ul>. But it's not that simple, because
  // whitespace text nodes are not out of place.
  if(item.nextElementSibling) {
    return;
  }

  // If the first child element isn't an item, then ignore the list
  if(!(item.localName in ITEM_NAMES)) {
    return;
  }

  // If the item is empty, then we are just going to remove the list.
  // If the list splits text nodes, then replace the list with a space.
  if(!item.firstChild) {
    if(isText(list.previousSibling) && isText(list.nextSibling)) {
      list.parentNode.replaceChild(document.createTextNode(' '), list);
    } else {
      list.remove();
    }

    return;
  }

  // If the node preceding the list is a text node, and the first child of the
  // item is a text node, then insert a space preceding the list.
  if(isText(list.previousSibling) && isText(item.firstChild)) {
    list.parentNode.insertBefore(document.createTextNode(' '), list);
  }

  // Move the item's child nodes to before the list node
  // TODO: maybe this operation is so simple I don't need to have the
  // dependency here?
  insertChildrenBefore(item, list);

  // If the node following the list is a text node, and the last child of
  // the item was a text node, then insert a space. At this point the list's
  // previous sibling is what was formerly the last child of the item.
  if(isText(list.nextSibling) &&  isText(list.previousSibling)) {
    list.parentNode.insertBefore(document.createTextNode(' '), list);
  }

  // The item has been emptied, so remove the entire list (which includes the
  // item)
  list.remove();
}

function isText(node) {
  return node && node.nodeType === Node.TEXT_NODE;
}

this.unwrapSingleItemLists = unwrapSingleItemLists;

} // End block scope
