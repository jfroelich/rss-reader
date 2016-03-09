// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

// TODO: IIAFE and drop pruned_ prefix on non-exported functions?
// TODO: merge table processing functions

var pruned_blacklist = [
  'applet',
  'audio',
  'basefont',
  'bgsound',
  'button',
  'command',
  'datalist',
  'dialog',
  'embed',
  'fieldset',
  'head',
  'input',
  'isindex',
  'link',
  'math',
  'meta',
  'noembded',
  'noscript',
  'object',
  'output',
  'optgroup',
  'option',
  'param',
  'progress',
  'script',
  'select',
  'spacer',
  'style',
  'textarea',
  'title',
  'video',
  'xmp'
];

var pruned_inline_element_names = [
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
];

var pruned_inline_element_selector = pruned_inline_element_names.join(',');

// Filters various nodes from a document
function pruned_transform(document) {
  'use strict';
  pruned_filter_comments(document);
  pruned_filter_frames(document);
  pruned_apply_blacklist(document);
  pruned_filter_hidden(document);

  const calamine = new Calamine();
  calamine.analyze(document);
  calamine.prune();

  pruned_filter_anchors(document);
  pruned_filter_breaks(document);
  pruned_filter_images(document);
  pruned_filter_inlines(document);
  pruned_filter_texts(document);
  pruned_filter_leaves(document);
  pruned_filter_lists(document);
  pruned_filter_single_cell_tables(document);
  pruned_filter_single_column_tables(document);
  pruned_trim_document(document);
  pruned_filter_attributes(document);
}

function pruned_filter_comments(document) {
  'use strict';
  const it = document.createNodeIterator(document.documentElement,
    NodeFilter.SHOW_COMMENT);
  for(let node = it.nextNode(); node; node = it.nextNode()) {
    node.remove();
  }
}

function pruned_apply_blacklist(document) {
  'use strict';
  const selector = pruned_blacklist.join(',');
  const elements = document.querySelectorAll(selector);
  const numElements = elements.length;
  const root = document.documentElement;
  for(let i = 0, element = root; i < numElements; i++) {
    element = elements[i];
    if(root.contains(element)) {
      element.remove();
    }
  }
}

function pruned_filter_frames(document) {
  'use strict';
  const body = document.body;

  if(body && body.localName === 'frameset') {
    const noframes = document.querySelector('noframes');

    const newBody = document.createElement('body');

    if(noframes) {
      // TODO: fix encoding issues, maybe use textContent instead?
      // or use appendChild?
      newBody.innerHTML = noframes.innerHTML;
    } else {
      newBody.textContent = 'Unable to display document due to frames.';
    }

    document.documentElement.appendChild(newBody);
    body.remove();
  }

  const elements = document.querySelectorAll('frameset, frame, iframe');
  const numElements = elements.length;
  const root = document.documentElement;
  for(let i = 0, element; i < numElements; i++) {
    element = elements[i];
    if(root.contains(element)) {
      element.remove();
    }
  }
}

function pruned_filter_breaks(document) {
  'use strict';

  // This is buggy, temporarily a NO-OP.
  if(true) {
    return;
  }

  // TODO: improve
  // error case: http://paulgraham.com/procrastination.html

  const elements = document.querySelectorAll('br');
  const numElements = elements.length;
  for(let i = 0, element, parent, p; i < numElements; i++) {
    element = elements[i];
    parent = element.parentNode;
    p = document.createElement('p');
    parent.replaceChild(p, element);
  }
}

function pruned_filter_attributes(document) {
  'use strict';
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
    elementName = element.localName;
    attributes = element.attributes;
    if(!attributes || !attributes.length) {
      continue;
    }

    // TODO: no-op on SVG leads to large strange svg images appearing
    // in the output, maybe I just can't support, or maybe I somehow
    // enforce maximum dimensions

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
}

function pruned_filter_hidden(document) {
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

  const elements = document.querySelectorAll(selector);
  const numElements = elements.length;
  const root = document.documentElement;
  for(let i = 0, element; i < numElements; i++) {
    element = elements[i];
    if(root.contains(element)) {
      element.remove();
    }
  }
}

function pruned_filter_inlines(document) {
  'use strict';

  // TODO: this is still slow. profile against the more naive version
  // that unwrapped all elements immediately

  const elements = document.querySelectorAll(pruned_inline_element_selector);
  const numElements = elements.length;

  for(let i = 0, element, firstChild, farthest, ancestor; i < numElements;
    i++) {
    element = elements[i];

    firstChild = element.firstChild;
    if(firstChild && firstChild === element.lastChild &&
      firstChild.nodeType === Node.ELEMENT_NODE &&
      firstChild.matches(pruned_inline_element_selector)) {
      // Skip
    } else {
      // Find shallowest consecutive inline ancestor
      farthest = null;
      for(ancestor = element.parentNode; ancestor &&
        ancestor.childElementCount === 1
        ancestor.matches(pruned_inline_element_selector);
        ancestor = ancestor.parentNode) {
        farthest = ancestor;
      }
      pruned_unwrap(element, farthest);
    }
  }
}

function pruned_filter_leaves(document) {
  'use strict';
  const leafSet = new Set();
  pruned_collect_leaves(leafSet, document.body,
    document.documentElement);
  const rootElement = document.documentElement;
  for(let leaf of leafSet) {
    if(rootElement.contains(leaf)) {
      leaf.remove();
    }
  }
}

// TODO: no recursion
function pruned_collect_leaves(leaves, bodyElement, element) {
  'use strict';
  const childNodes = element.childNodes;
  const numChildNodes = childNodes.length;
  for(let i = 0, cursor; i < numChildNodes; i++) {
    cursor = childNodes[i];
    if(cursor.nodeType === Node.ELEMENT_NODE) {
      if(pruned_is_leaf(bodyElement, cursor)) {
        leaves.add(cursor);
      } else {
        pruned_collect_leaves(leaves, bodyElement, cursor);
      }
    }
  }
}

// TODO: remove the bodyElement parameter
// TODO: non-recursive
function pruned_is_leaf(bodyElement, element) {
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
      if(!pruned_is_leaf(bodyElement, node)) {
        return false;
      }
    } else {
      return false;
    }
  }

  return true;
}

function pruned_filter_anchors(document) {
  'use strict';
  const elements = document.querySelectorAll('a');
  const numElements = elements.length;
  const JSPROTOCOL = /\s*javascript\s*:/i;
  for(let i = 0, anchor; i < elements.length; i++) {
    anchor = elements[i];
    if(!anchor.hasAttribute('name') && !anchor.hasAttribute('href')) {
      // It is a nominal anchor, unwrap
      pruned_unwrap(anchor);
    } else if(anchor.hasAttribute('href') &&
      JSPROTOCOL.test(anchor.getAttribute('href'))) {
      // If it is a javascript anchor, remove the link
      // TODO: maybe unwrap or remove?
      anchor.setAttribute('href', '');
    }
  }
}

function pruned_filter_single_cell_tables(document) {
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
        parent = table.parentNode;
        parent.insertBefore(document.createTextNode(' '), table);
        pruned_insert_children_before(cell, table);
        parent.insertBefore(document.createTextNode(' '), table);
        table.remove();
      }
    }
  }
}

function pruned_filter_single_column_tables(document) {
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
      pruned_transform_single_column_table(table);
    }
  }
}

function pruned_transform_single_column_table(table) {
  'use strict';
  const parent = table.parentNode;
  const document = table.ownerDocument;
  for(let rows = table.rows, numRows = rows.length, rowIndex = 0,
    columnIndex = 0, cell, cells, numCells = 0;
    rowIndex < numRows; rowIndex++) {
    for(columnIndex = 0, cells = rows[rowIndex], numCells = cells.length;
      columnIndex < numCells; columnIndex++) {
      cell = cells[columnIndex];
      pruned_insert_children_before(cell, table);
    }

    parent.insertBefore(document.createElement('p'), table);
  }

  table.remove();
}

function pruned_filter_lists(document) {
  'use strict';
  const lists = document.querySelectorAll('ul, ol');
  const numLists = lists.length;
  for(let i = 0, list, node, item; i < numLists; i++) {
    list = lists[i];
    if(list.childElementCount === 1) {
      item = list.firstElementChild;
      if(item.localName === 'li') {
        pruned_insert_children_before(item, list);
        list.remove();
      }
    }
  }
}

function pruned_filter_images(document) {
  'use strict';
  const images = document.querySelectorAll('img');
  const numImages = images.length;
  for(let i = 0, image; i < numImages; i++) {
    image = images[i];
    if(!image.hasAttribute('src') && !image.hasAttribute('srcset')) {
      // images must have a source
      image.remove();
    } else if(image.width < 2 || image.height < 2) {
      // it is probably a tracer
      image.remove();
    }
  }
}

function pruned_trim_document(document) {
  'use strict';
  const body = document.body;
  if(body) {
    let sibling = body;
    let node = body.firstChild;
    while(node && pruned_is_trimmable(node)) {
      sibling = node.nextSibling;
      node.remove();
      node = sibling;
    }

    node = body.lastChild;
    while(node && pruned_is_trimmable(node)) {
      sibling = node.previousSibling;
      node.remove();
      node = sibling;
    }
  }
}

function pruned_is_trimmable(node) {
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
}

function pruned_filter_texts(document) {
  'use strict';
  const it = document.createNodeIterator(document.documentElement,
    NodeFilter.SHOW_TEXT);
  for(let node = it.nextNode(); node; node = it.nextNode()) {
    switch(node.nodeValue) {
      case '\n':
      case '\n\t':
      case '\n\t\t':
      case '\n\t\t\t':
        break;
      default:
        // Normalize whitespace
        node.nodeValue = node.nodeValue.replace(/&nbsp;/ig, ' ');
        break;
    }

    if(!node.parentNode.closest('code, pre, ruby, textarea, xmp')) {
      node.nodeValue = node.nodeValue.replace(/\s{2,}/g, ' ');
    }
  }
}

// Unwraps the element's child nodes into the parent of the element or, if
// provided, the parent of the alternate element
function pruned_unwrap(element, referenceNode) {
  'use strict';
  const target = referenceNode || element;
  const parent = target.parentNode;
  const document = element.ownerDocument;
  const prevSibling = target.previousSibling;
  const nextSibling = target.nextSibling;
  if(parent) {
    if(prevSibling && prevSibling.nodeType === Node.TEXT_NODE)
      parent.insertBefore(document.createTextNode(' '), target);
    pruned_insert_children_before(element, target);
    if(nextSibling && nextSibling.nodeType === Node.TEXT_NODE)
      parent.insertBefore(document.createTextNode(' '), target);
  }
  target.remove();
}

function pruned_insert_children_before(parentNode, referenceNode) {
  'use strict';
  const referenceParent = referenceNode.parentNode;
  for(let node = parentNode.firstChild; node; node = parentNode.firstChild) {
    referenceParent.insertBefore(node, referenceNode);
  }
}
