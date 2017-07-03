// See license.md

'use strict';

// TODO: replace strong with b to shrink document size
// TODO: replace em with i to shrink document size
// TODO: replace entities with single unicode character where possible in order
// to shrink document size?
// TODO: fix things like <b><table></table></b>,
// see https://html.spec.whatwg.org/multipage/parsing.html mentions of
// adoption algorithm and its errata notes

// TODO: make this into its own library, with a single global. Probably best
// to use an object namespace so that individual functions are exposed
// TODO: probably simplify the name, just name it scrubby or something
// or maybe use different libraries, one for disabling script and similar
// security issues, one for shrinking, one for validation


// Module for sanitizing the contents of a document
const jrDomScrubBlacklist = [
  'applet', 'audio', 'base', 'basefont', 'bgsound', 'button', 'command',
  'datalist', 'dialog', 'embed', 'fieldset', 'frame', 'frameset', 'head',
  'iframe', 'input', 'isindex', 'link', 'math', 'meta',
  'object', 'output', 'optgroup', 'option', 'param', 'path', 'progress',
  'script', 'select', 'spacer', 'style', 'svg', 'textarea', 'title',
  'video', 'xmp'
];

const jrDomScrubBlacklistSelector = jrDomScrubBlacklist.join(',');

function jrDomScrubScrub(doc) {
  jrDOMScrubFilterComments(doc);
  jrDOMScrubFilterFrames(doc);
  jrDOMScrubFilterNoscripts(doc);
  jrDOMScrubFilterBlacklist(doc);
  jrDOMScrubFilterHidden(doc);
  jrDOMScrubAdjustBlockInlines(doc);
  jrDOMScrubFilterBRs(doc);
  jrDOMScrubFilterScriptAnchors(doc);
  jrDOMScrubFilterFormatAnchors(doc);
  jrDOMScrubFilterSmallImages(doc, 2);
  jrDOMScrubFilterSourcelessImages(doc);
  jrDOMScrubFilterUnwrappables(doc);
  jrDOMScrubFilterFigures(doc);
  jrDOMScrubFilterHairspaces(doc);
  jrDOMScrubCondenseNodeWhitespace(doc);
  jrDOMScrubFilterSingleItemLists(doc);
  jrDOMScrubFilterTables(doc, 20);
  jrDOMScrubFilterLeaves(doc);
  jrDOMScrubFilterHRs(doc);
  jrDOMScrubTrimDocument(doc);
  jrDOMScrubFilterAttributes(doc);
}

function jrDOMScrubAddNoReferrer(doc) {
  const anchors = doc.querySelectorAll('a');
  for(let anchor of anchors) {
    anchor.setAttribute('rel', 'noreferrer');
  }
}

// Looks for cases such as <a><p>text</p></a> and transforms them into
// <p><a>text</a></p>.
function jrDOMScrubAdjustBlockInlines(doc) {
  const blockSelector = 'blockquote, h1, h2, h3, h4, h5, h6, p';
  const inlineSelector = 'a';
  const blocks = doc.querySelectorAll(blockSelector);
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
}

function jrDOMScrubCondenseNodeWhitespace(doc) {
  const it = doc.createNodeIterator(doc.documentElement,
    NodeFilter.SHOW_TEXT);
  for(let node = it.nextNode(); node; node = it.nextNode()) {
    const value = node.nodeValue;
    if(value.length > 3 && !jrDOMScrubIsSensitiveDescendant(node)) {
      const condensed = jrDOMScrubCondenseWhitespace(value);
      if(condensed.length !== value.length)
        node.nodeValue = condensed;
    }
  }
}

// Find any sequence of 2 or more whitespace characters and replace with a
// single space
function jrDOMScrubCondenseWhitespace(value) {
  return value.replace(/\s{2,}/g, ' ');
}

// Returns true if the node lies within a whitespace sensitive element
function jrDOMScrubIsSensitiveDescendant(node) {
  return node.parentNode.closest('code, pre, ruby, textarea, xmp');
}

function jrDOMScrubFilterScriptAnchors(doc) {
  const anchors = doc.querySelectorAll('a');
  for(let anchor of anchors) {
    if(jrDOMScrubIsScriptURL(anchor.getAttribute('href')))
      jrDOMScrubUnwrap(anchor);
  }
}

function jrDOMScrubIsScriptURL(urlString) {
  return urlString && urlString.length > 11 &&
    /^\s*javascript:/i.test(urlString);
}

function jrDOMScrubFilterFormatAnchors(doc) {
  const anchors = doc.querySelectorAll('a');
  for(let anchor of anchors) {
    if(!anchor.hasAttribute('href') && !anchor.hasAttribute('name'))
      jrDOMScrubUnwrap(anchor);
  }
}

function jrDOMScrubFilterBlacklist(doc) {
  const docElement = doc.documentElement;
  const elements = doc.querySelectorAll(jrDomScrubBlacklistSelector);
  for(let element of elements) {
    if(docElement.contains(element))
      element.remove();
  }
}

function jrDOMScrubFilterBRs(doc) {
  const elements = doc.querySelectorAll('br + br');
  for(let element of elements) {
    element.remove();
  }
}

function jrDOMScrubFilterComments(doc) {
  const docElement = doc.documentElement;
  const it = doc.createNodeIterator(docElement, NodeFilter.SHOW_COMMENT);
  for(let node = it.nextNode(); node; node = it.nextNode()) {
    node.remove();
  }
}

function jrDOMScrubFilterFrames(doc) {
  const frameset = doc.body;
  if(!frameset || frameset.localName !== 'frameset')
    return;

  const body = doc.createElement('body');
  const noframes = doc.querySelector('noframes');
  if(noframes) {
    for(let node = noframes.firstChild; node; node = noframes.firstChild) {
      body.appendChild(node);
    }
  } else {
    const error = doc.createTextNode('Unable to display framed document.');
    body.appendChild(error);
  }

  frameset.remove();
  doc.documentElement.appendChild(body);
}

// TODO: cleanup, use helpler functions
function jrDOMScrubFilterAttributes(doc) {
  const elements = doc.getElementsByTagName('*');
  for(let element of elements) {
    let el_name = element.localName;
    let attributes = element.attributes;
    if(!attributes || !attributes.length)
      continue;

    if(el_name === 'source') {
      for(let i = attributes.length - 1; i > -1; i--) {
        let attr_name = attributes[i].name;
        if(attr_name !== 'type' && attr_name !== 'srcset' &&
          attr_name !== 'sizes' && attr_name !== 'media' &&
          attr_name !== 'src') {
          element.removeAttribute(attr_name);
        }
      }
    } else if(el_name === 'a') {
      for(let i = attributes.length - 1; i > -1; i--) {
        let attr_name = attributes[i].name;
        if(attr_name !== 'href' && attr_name !== 'name' &&
          attr_name !== 'title') {
          element.removeAttribute(attr_name);
        }
      }
    } else if(el_name === 'iframe') {
      for(let i = attributes.length - 1; i > -1; i--) {
        let attr_name = attributes[i].name;
        if(attr_name !== 'src') {
          element.removeAttribute(attr_name);
        }
      }
    } else if(el_name === 'img') {
      for(let i = attributes.length - 1; i > -1; i--) {
        let attr_name = attributes[i].name;
        if(attr_name !== 'src' && attr_name !== 'alt' &&
          attr_name !== 'srcset' && attr_name !== 'title') {
          element.removeAttribute(attr_name);
        }
      }
    } else {
      for(let i = attributes.length - 1; i > -1; i--) {
        element.removeAttribute(attributes[i].name);
      }
    }
  }
}

function jrDOMScrubFilterHidden(doc) {
  const selector = [
    '[style*="display:none"]',
    '[style*="visibility:hidden"]',
    '[style*="opacity:0.0"]',
    '[aria-hidden="true"]'
  ].join(',');

  const elements = doc.querySelectorAll(selector);
  const docElement = doc.documentElement;
  for(let element of elements) {
    if(element !== docElement && docElement.contains(element))
      jrDOMScrubUnwrap(element);
  }
}

function jrDOMScrubFilterHRs(doc) {
  const elements = doc.querySelectorAll('hr + hr, ul > hr, ol > hr');
  for(let element of elements) {
    element.remove();
  }
}

function jrDOMScrubFilterSmallImages(doc, minDimValue) {
  const images = doc.querySelectorAll('img');
  for(let img of images) {
    if(img.width < minDimValue || img.height < minDimValue)
      img.remove();
  }
}

function jrDOMScrubFilterSourcelessImages(doc) {
  const images = doc.querySelectorAll('img');
  for(let img of images) {
    if(!img.hasAttribute('src') && !img.hasAttribute('srcset'))
      img.remove();
  }
}

function jrDOMScrubFilterInvalidAnchors(doc) {
  const anchors = doc.querySelectorAll('a');
  for(let anchor of anchors) {
    if(jrDOMScrubIsInvalidAnchor(anchor))
      anchor.remove();
  }
}

function jrDOMScrubIsInvalidAnchor(anchor) {
  const href = anchor.getAttribute('href');
  return href && /^\s*https?:\/\/#/i.test(href);
}

function jrDOMScrubFilterLeaves(doc) {
  if(!doc.body)
    return;
  const docElement = doc.documentElement;
  const elements = doc.body.querySelectorAll('*');
  for(let element of elements) {
    if(docElement.contains(element) && jrDOMScrubIsLeaf(element))
      element.remove();
  }
}

function jrDOMScrubIsLeafException(element) {
  const exceptions = {
    'area': 0, 'audio': 0, 'base': 0, 'col': 0, 'command': 0, 'br': 0,
    'canvas': 0, 'col': 0, 'hr': 0, 'iframe': 0, 'img': 0, 'input': 0,
    'keygen': 0, 'meta': 0, 'nobr': 0, 'param': 0, 'path': 0, 'source': 0,
    'sbg': 0, 'textarea': 0, 'track': 0, 'video': 0, 'wbr': 0
  };

  return element.localName in exceptions;
}

function jrDOMScrubIsLeaf(node) {
  switch(node.nodeType) {
    case Node.ELEMENT_NODE:
      if(jrDOMScrubIsLeafException(node))
        return false;
      for(let child = node.firstChild; child; child = child.nextSibling) {
        if(!jrDOMScrubIsLeaf(child))
          return false;
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

function jrDOMScrubFilterTables(doc, limit) {
  const tables = doc.querySelectorAll('table');
  for(let table of tables) {
    if(jrDOMScrubIsSingleColumnTable(table, limit))
      jrDOMScrubUnwrapSingleColumnTable(table);
  }
}

function jrDOMScrubIsSingleColumnTable(table, limit) {
  const rows = table.rows;
  const upper = Math.min(rows.length, limit);
  for(let i = 0; i < upper; i++) {
    if(!jrDOMScrubIsSingleColumnRow(rows[i]))
      return false;
  }
  return true;
}

function jrDOMScrubIsSingleColumnRow(row) {
  const cells = row.cells;
  let numNonEmpty = 0;
  // TODO: for .. of?
  for(let i = 0, len = cells.length; i < len; i++) {
    if(!jrDOMScrubIsLeaf(cells[i])) {
      if(++numNonEmpty > 1)
        return false;
    }
  }

  return true;
}

// TODO: only pad if adjacent to text
// TODO: can i use for..of over table.rows?
function jrDOMScrubUnwrapSingleColumnTable(table) {
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
      jrDOMScrubInsertChildrenBefore(cell, table);
    }

    parent.insertBefore(doc.createElement('p'), table);
  }

  parent.insertBefore(doc.createTextNode(' '), table);
  table.remove();
}

function jrDOMScrubFilterUnwrappables(doc) {
  const selector = [
    'abbr', 'acronym', 'article', 'aside', 'center', 'colgroup', 'data',
    'details', 'div', 'footer', 'header', 'help', 'hgroup', 'ilayer',
    'insert', 'layer', 'legend', 'main', 'mark', 'marquee', 'meter',
    'multicol', 'nobr', 'section', 'span', 'tbody', 'tfoot', 'thead', 'form',
    'label', 'big', 'blink', 'font', 'plaintext', 'small', 'tt'
  ].join(',');
  const elements = doc.querySelectorAll(selector);
  for(let element of elements) {
    jrDOMScrubUnwrap(element);
  }
}

function jrDOMScrubFilterHairspaces(doc) {
  const it = doc.createNodeIterator(doc.documentElement,
    NodeFilter.SHOW_TEXT);
  for(let node = it.nextNode(); node; node = it.nextNode()) {
    const value = node.nodeValue;
    const modified = value.replace(/&(hairsp|#8082|#x200a);/ig, ' ');
    if(modified.length !== value.length)
      node.nodeValue = modified;
  }
}

function jrDOMScrubFilterNoscripts(doc) {
  const elements = doc.querySelectorAll('noscript');
  for(let element of elements) {
    jrDOMScrubUnwrap(element);
  }
}

function jrDOMScrubFilterFigures(doc) {
  const figures = doc.querySelectorAll('figure');
  for(let figure of figures) {
    if(figure.childElementCount === 1)
      jrDOMScrubUnwrap(figure);
  }
}

function jrDOMScrubTrimDocument(doc) {
  if(!doc.body)
    return;
  const firstChild = doc.body.firstChild;
  if(firstChild) {
    jrDOMScrubTrimWalk(firstChild, 'nextSibling');
    const lastChild = doc.body.lastChild;
    if(lastChild && lastChild !== firstChild)
      jrDOMScrubTrimWalk(lastChild, 'previousSibling');
  }
}

function jrDOMScrubCanTrim(node) {
  const els = ['br', 'hr', 'nobr'];
  return node && (els.includes(node.localName) ||
    (node.nodeType === Node.TEXT_NODE && !node.nodeValue.trim()));
}

function jrDOMScrubTrimWalk(startNode, edge) {
  let node = startNode;
  while(jrDOMScrubCanTrim(node)) {
    let sibling = node[edge];
    node.remove();
    node = sibling;
  }
}

function jrDOMScrubUnwrap(element, refNode) {
  const target = refNode || element;
  const parent = target.parentNode;
  if(!parent)
    throw new TypeError();
  const doc = element.ownerDocument;
  const prevSib = target.previousSibling;
  if(prevSib && prevSib.nodeType === Node.TEXT_NODE)
    parent.insertBefore(doc.createTextNode(' '), target);
  jrDOMScrubInsertChildrenBefore(element, target);
  const nextSib = target.nextSibling;
  if(nextSib && nextSib.nodeType === Node.TEXT_NODE)
    parent.insertBefore(doc.createTextNode(' '), target);
  target.remove();
}

function jrDOMScrubInsertChildrenBefore(parentNode, refNode) {
  const refParent = refNode.parentNode;
  for(let node = parentNode.firstChild; node; node = parentNode.firstChild) {
    refParent.insertBefore(node, refNode);
  }
}

function jrDOMScrubFilterSingleItemLists(doc) {
  const lists = doc.querySelectorAll('ul, ol, dl');
  for(let list of lists) {
    jrDOMScrubFilterSingleItemList(doc, list);
  }
}

// Unwraps single item or empty list elements
function jrDOMScrubFilterSingleItemList(doc, list) {
  const listParent = list.parentNode;
  if(!listParent)
    return;

  const item = list.firstElementChild;

  // If the list has no child elements then move its child nodes out of the
  // list and remove it
  if(!item) {
    // If it is just <list>...<item/>...<list> then remove
    if(!list.firstChild) {
      list.remove();
      return;
    }
    // The list has no child elements, but the list has one or more child
    // nodes. Move the nodes to before the list. Add padding if needed.
    if(jrDOMScrubIsTextNode(list.previousSibling))
      listParent.insertBefore(doc.createTextNode(' '), list);
    for(let node = list.firstChild; node; node = list.firstChild) {
      listParent.insertBefore(node, list);
    }
    if(jrDOMScrubIsTextNode(list.nextSibling))
      listParent.insertBefore(doc.createTextNode(' '), list);
    list.remove();
    return;
  }

  // If the list has more than one child element then leave the list as is
  if(item.nextElementSibling)
    return;
  // If the list's only child element isn't one of the correct types, ignore it
  const list_item_names = {'li': 0, 'dt': 0, 'dd': 0};
  if(!(item.localName in list_item_names))
    return;

  // If the list has one child element of the correct type, and that child
  // element has no inner content, then remove the list. This will also remove
  // any non-element nodes within the list outside of the child element.
  if(!item.firstChild) {
    // If removing the list, avoid the possible merging of adjacent text nodes
    if(jrDOMScrubIsTextNode(list.previousSibling) &&
      jrDOMScrubIsTextNode(list.nextSibling))
      listParent.replaceChild(doc.createTextNode(' '), list);
    else
      list.remove();
    return;
  }

  // The list has one child element with one or more child nodes. Move the
  // child nodes to before the list and then remove it. Add padding if needed.
  if(jrDOMScrubIsTextNode(list.previousSibling) &&
    jrDOMScrubIsTextNode(item.firstChild))
    listParent.insertBefore(doc.createTextNode(' '), list);
  jrDOMScrubInsertChildrenBefore(item, list);
  if(jrDOMScrubIsTextNode(list.nextSibling) &&
    jrDOMScrubIsTextNode(list.previousSibling))
    listParent.insertBefore(doc.createTextNode(' '), list);
  list.remove();
}

function jrDOMScrubIsTextNode(node) {
  return node && node.nodeType === Node.TEXT_NODE;
}
