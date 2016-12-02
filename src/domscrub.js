// See license.md

'use strict';

// Module for sanitizing the contents of a document

class DOMScrubber {

  constructor() {
    this.blacklist = [
      'applet', 'audio', 'base', 'basefont', 'bgsound', 'button', 'command',
      'datalist', 'dialog', 'embed', 'fieldset', 'frame', 'frameset', 'head',
      'iframe', 'input', 'isindex', 'link', 'math', 'meta',
      'object', 'output', 'optgroup', 'option', 'param', 'path', 'progress',
      'script', 'select', 'spacer', 'style', 'svg', 'textarea', 'title',
      'video', 'xmp'
    ];
    this.blacklistSelector = this.blacklist.join(',');
  }

  scrub(doc) {
    this.filterComments(doc);
    this.filterFrames(doc);
    this.filterNoscripts(doc);
    this.filterBlacklist(doc);
    this.filterHidden(doc);
    this.adjustBlockInlines(doc);
    this.filterBRs(doc);
    this.filterScriptAnchors(doc);
    this.filterFormatAnchors(doc);
    this.filterSmallImages(doc, 2);
    DOMScrubber.filterSourcelessImages(doc);
    this.filterUnwrappables(doc);
    this.filterFigures(doc);
    this.filterHairs(doc);
    this.condenseNodeWhitespace(doc);
    this.filterSingleItemLists(doc);
    this.filterTables(doc, 20);
    this.filterLeaves(doc);
    this.filterHRs(doc);
    this.trimDoc(doc);
    this.filterAttributes(doc);
  }

  static addNoReferrer(doc) {
    const anchors = doc.querySelectorAll('a');
    for(let anchor of anchors) {
      anchor.setAttribute('rel', 'noreferrer');
    }
  }

  // Looks for cases such as <a><p>text</p></a> and transforms them into
  // <p><a>text</a></p>.
  adjustBlockInlines(doc) {
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

  condenseNodeWhitespace(doc) {
    const it = doc.createNodeIterator(doc.documentElement,
      NodeFilter.SHOW_TEXT);
    for(let node = it.nextNode(); node; node = it.nextNode()) {
      const value = node.nodeValue;
      if(value.length > 3 && !this.isSensitiveDescendant(node)) {
        const condensed = this.condenseWhitespace(value);
        if(condensed.length !== value.length)
          node.nodeValue = condensed;
      }
    }
  }

  condenseWhitespace(nodeValue) {
    return nodeValue.replace(/\s{2,}/g, ' ');
  }

  // Returns true if the node lies within a whitespace sensitive element
  isSensitiveDescendant(textNode) {
    return textNode.parentNode.closest('code, pre, ruby, textarea, xmp');
  }

  filterScriptAnchors(doc) {
    const anchors = doc.querySelectorAll('a');
    for(let anchor of anchors) {
      if(this.isScriptURL(anchor.getAttribute('href')))
        this.unwrap(anchor);
    }
  }

  isScriptURL(urlString) {
    return urlString && urlString.length > 11 &&
      /^\s*javascript:/i.test(urlString);
  }

  filterFormatAnchors(doc) {
    const anchors = doc.querySelectorAll('a');
    for(let anchor of anchors) {
      if(!anchor.hasAttribute('href') && !anchor.hasAttribute('name'))
        this.unwrap(anchor);
    }
  }

  filterBlacklist(doc) {
    const docElement = doc.documentElement;
    const elements = doc.querySelectorAll(this.blacklistSelector);
    for(let element of elements) {
      if(docElement.contains(element))
        element.remove();
    }
  }

  filterBRs(doc) {
    const elements = doc.querySelectorAll('br + br');
    for(let element of elements) {
      element.remove();
    }
  }

  filterComments(doc) {
    const docElement = doc.documentElement;
    const it = doc.createNodeIterator(docElement, NodeFilter.SHOW_COMMENT);
    for(let node = it.nextNode(); node; node = it.nextNode()) {
      node.remove();
    }
  }

  filterFrames(doc) {
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

  // TODO: cleanup
  filterAttributes(doc) {
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

  filterHidden(doc) {
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
        this.unwrap(element);
    }
  }

  filterHRs(doc) {
    const selector = 'hr + hr, ul > hr, ol > hr';
    const elements = doc.querySelectorAll(selector);
    for(let element of elements) {
      element.remove();
    }
  }

  filterSmallImages(doc, minDimValue) {
    const images = doc.querySelectorAll('img');
    for(let img of images) {
      if(img.width < minDimValue || img.height < minDimValue)
        img.remove();
    }
  }

  static filterSourcelessImages(doc) {
    const images = doc.querySelectorAll('img');
    for(let img of images) {
      if(!img.hasAttribute('src') && !img.hasAttribute('srcset'))
        img.remove();
    }
  }

  static filterInvalidAnchors(doc) {
    const anchors = doc.querySelectorAll('a');
    for(let anchor of anchors) {
      if(DOMScrubber.isInvalidAnchor(anchor))
        anchor.remove();
    }
  }

  static isInvalidAnchor(anchor) {
    const href = anchor.getAttribute('href');
    return href && /^\s*https?:\/\/#/i.test(href);
  }

  filterLeaves(doc) {
    if(!doc.body)
      return;

    const docElement = doc.documentElement;
    const elements = doc.body.querySelectorAll('*');
    for(let element of elements) {
      if(docElement.contains(element) && this.isLeaf(element))
        element.remove();
    }
  }

  // An element is a leaf unless it is a named exception, contains a
  // non-whitespace-only text node, or contains at least one non-leaf child
  // element. This is a recursive function.
  isLeaf(node) {

    const exceptions = {
      'area': 0, 'audio': 0, 'base': 0, 'col': 0, 'command': 0, 'br': 0,
      'canvas': 0, 'col': 0, 'hr': 0, 'iframe': 0, 'img': 0, 'input': 0,
      'keygen': 0, 'meta': 0, 'nobr': 0, 'param': 0, 'path': 0, 'source': 0,
      'sbg': 0, 'textarea': 0, 'track': 0, 'video': 0, 'wbr': 0
    };

    switch(node.nodeType) {
      case Node.ELEMENT_NODE:
        if(node.localName in exceptions)
          return false;
        for(let child = node.firstChild; child; child = child.nextSibling) {
          if(!this.isLeaf(child))
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

  filterTables(doc, limit) {
    const tables = doc.querySelectorAll('table');
    for(let table of tables) {
      if(this.isSingleColTable(table, limit))
        this.unwrapSingleColTable(table);
    }
  }

  isSingleColTable(table, limit) {
    const rows = table.rows;
    const upper = Math.min(rows.length, limit);
    for(let i = 0; i < upper; i++) {
      if(!this.isSingleColRow(rows[i]))
        return false;
    }
    return true;
  }

  // TODO: for .. of?
  isSingleColRow(row) {
    const cells = row.cells;
    let numNonEmpty = 0;
    for(let i = 0, len = cells.length; i < len; i++) {
      const cell = cells[i];
      if(!this.isLeaf(cell)) {
        if(++numNonEmpty > 1)
          return false;
      }
    }

    return true;
  }

  // TODO: only pad if adjacent to text
  // TODO: can i use for..of over table.rows?
  unwrapSingleColTable(table) {
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
        this.insertChildrenBefore(cell, table);
      }

      parent.insertBefore(doc.createElement('p'), table);
    }

    parent.insertBefore(doc.createTextNode(' '), table);
    table.remove();
  }

  filterUnwrappables(doc) {
    const selector = [
      'abbr', 'acronym', 'article', 'aside', 'center', 'colgroup', 'data',
      'details', 'div', 'footer', 'header', 'help', 'hgroup', 'ilayer',
      'insert', 'layer', 'legend', 'main', 'mark', 'marquee', 'meter',
      'multicol', 'nobr', 'section', 'span', 'tbody', 'tfoot', 'thead', 'form',
      'label', 'big', 'blink', 'font', 'plaintext', 'small', 'tt'
    ].join(',');
    const elements = doc.querySelectorAll(selector);
    for(let element of elements) {
      this.unwrap(element);
    }
  }

  filterHairs(doc) {
    const it = doc.createNodeIterator(doc.documentElement,
      NodeFilter.SHOW_TEXT);
    for(let node = it.nextNode(); node; node = it.nextNode()) {
      const value = node.nodeValue;
      const modified = value.replace(/&(hairsp|#8082|#x200a);/ig, ' ');
      if(modified.length !== value.length)
        node.nodeValue = modified;
    }
  }

  filterNoscripts(doc) {
    const elements = doc.querySelectorAll('noscript');
    for(let element of elements) {
      this.unwrap(element);
    }
  }

  filterFigures(doc) {
    const figures = doc.querySelectorAll('figure');
    for(let figure of figures) {
      if(figure.childElementCount === 1)
        this.unwrap(figure);
    }
  }

  trimDoc(doc) {
    if(!doc.body)
      return;
    const firstChild = doc.body.firstChild;
    if(firstChild) {
      this.trimWalk(firstChild, 'nextSibling');
      const lastChild = doc.body.lastChild;
      if(lastChild && lastChild !== firstChild)
        this.trimWalk(lastChild, 'previousSibling');
    }
  }

  canTrim(node) {
    const els = ['br', 'hr', 'nobr'];
    return node && (els.includes(node.localName) ||
      (node.nodeType === Node.TEXT_NODE && !node.nodeValue.trim()));
  }

  trimWalk(startNode, edge) {
    let node = startNode;
    while(this.canTrim(node)) {
      let sibling = node[edge];
      node.remove();
      node = sibling;
    }
  }

  unwrap(element, refNode) {
    const target = refNode || element;
    const parent = target.parentNode;
    if(!parent)
      throw new TypeError();
    const doc = element.ownerDocument;
    const prevSib = target.previousSibling;
    if(prevSib && prevSib.nodeType === Node.TEXT_NODE)
      parent.insertBefore(doc.createTextNode(' '), target);
    this.insertChildrenBefore(element, target);
    const nextSib = target.nextSibling;
    if(nextSib && nextSib.nodeType === Node.TEXT_NODE)
      parent.insertBefore(doc.createTextNode(' '), target);
    target.remove();
  }

  insertChildrenBefore(parentNode, refNode) {
    const refParent = refNode.parentNode;
    for(let node = parentNode.firstChild; node; node = parentNode.firstChild) {
      refParent.insertBefore(node, refNode);
    }
  }

  filterSingleItemLists(doc) {
    const lists = doc.querySelectorAll('ul, ol, dl');
    for(let list of lists) {
      this.filterSingleItemList(doc, list);
    }
  }

  // Unwraps single item or empty list elements
  filterSingleItemList(doc, list) {
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
      if(this.isTextNode(list.previousSibling))
        listParent.insertBefore(doc.createTextNode(' '), list);
      for(let node = list.firstChild; node; node = list.firstChild) {
        listParent.insertBefore(node, list);
      }
      if(this.isTextNode(list.nextSibling))
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
      if(this.isTextNode(list.previousSibling) &&
        this.isTextNode(list.nextSibling))
        listParent.replaceChild(doc.createTextNode(' '), list);
      else
        list.remove();
      return;
    }

    // The list has one child element with one or more child nodes. Move the
    // child nodes to before the list and then remove it. Add padding if needed.
    if(this.isTextNode(list.previousSibling) &&
      this.isTextNode(item.firstChild))
      listParent.insertBefore(doc.createTextNode(' '), list);
    this.insertChildrenBefore(item, list);
    if(this.isTextNode(list.nextSibling) &&
      this.isTextNode(list.previousSibling))
      listParent.insertBefore(doc.createTextNode(' '), list);
    list.remove();
  }

  isTextNode(node) {
    return node && node.nodeType === Node.TEXT_NODE;
  }
}
