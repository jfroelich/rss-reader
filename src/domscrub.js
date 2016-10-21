// See license.md

'use strict';

// For sanitizing the contents of a document

{

function scrub_dom(doc) {
  filter_comments(doc);
  filter_frames(doc);
  filter_noscripts(doc);
  filter_blacklist(doc);
  filter_hidden(doc);
  adjust_block_inlines(doc);
  filter_breaks(doc);
  filter_script_anchors(doc);
  filter_format_anchors(doc);
  filter_small_images(doc);
  filter_sourceless_images(doc);
  filter_unwrappables(doc);
  filter_figures(doc);
  filter_hairs(doc);
  condense_node_whitespace(doc);
  filter_single_item_lists(doc);
  filter_tables(doc, 20);
  filter_leaves(doc);
  filter_hrs(doc);
  trim_doc(doc);
  filter_attrs(doc);
};

function add_no_referrer(doc) {
  const anchors = doc.querySelectorAll('a');
  for(let anchor of anchors) {
    anchor.setAttribute('rel', 'noreferrer');
  }
}

// Looks for cases such as <a><p>text</p></a> and transforms them into
// <p><a>text</a></p>.
function adjust_block_inlines(doc) {
  const block_selector = 'blockquote, h1, h2, h3, h4, h5, h6, p';
  const inline_block_selector = 'a';
  const blocks = doc.querySelectorAll(block_selector);
  for(let block of blocks) {
    const ancestor = block.closest(inline_block_selector);
    if(ancestor && ancestor.parentNode) {
      ancestor.parentNode.insertBefore(block, ancestor);
      for(let node = block.firstChild; node; node = block.firstChild) {
        ancestor.appendChild(node);
      }
      block.appendChild(ancestor);
    }
  }
}

function condense_node_whitespace(doc) {
  const ws_sensitive = 'code, pre, ruby, textarea, xmp';
  const it = doc.createNodeIterator(doc.documentElement, NodeFilter.SHOW_TEXT);
  for(let n = it.nextNode(); n; n = it.nextNode()) {
    const value = n.nodeValue;
    if(value.length > 3 && !n.parentNode.closest(ws_sensitive)) {
      const condensed = value.replace(/\s{2,}/g, ' ');
      if(condensed.length !== value.length)
        n.nodeValue = condensed;
    }
  }
}

function filter_script_anchors(doc) {
  const anchors = doc.querySelectorAll('a');
  for(let anchor of anchors) {
    const url = anchor.getAttribute('href');
    if(url && url.length > 11 && /^\s*javascript:/i.test(url))
      unwrap(anchor);
  }
}

function filter_format_anchors(doc) {
  const anchors = doc.querySelectorAll('a');
  for(let anchor of anchors) {
    if(!anchor.hasAttribute('href') && !anchor.hasAttribute('name'))
      unwrap(anchor);
  }
}

const blacklist = [
  'applet', 'audio', 'base', 'basefont', 'bgsound', 'button', 'command',
  'datalist', 'dialog', 'embed', 'fieldset', 'frame', 'frameset', 'head',
  'iframe', 'input', 'isindex', 'link', 'math', 'meta',
  'object', 'output', 'optgroup', 'option', 'param', 'path', 'progress',
  'script', 'select', 'spacer', 'style', 'svg', 'textarea', 'title',
  'video', 'xmp'
];
const blacklist_selector = blacklist.join(',');

function filter_blacklist(doc) {
  const doc_element = doc.documentElement;
  const elements = doc.querySelectorAll(blacklist_selector);
  for(let element of elements) {
    if(doc_element.contains(element))
      element.remove();
  }
}

function filter_breaks(doc) {
  const elements = doc.querySelectorAll('br + br');
  for(let element of elements) {
    element.remove();
  }
}

function filter_comments(doc) {
  const doc_element = doc.documentElement;
  const it = doc.createNodeIterator(doc_element, NodeFilter.SHOW_COMMENT);
  for(let node = it.nextNode(); node; node = it.nextNode()) {
    node.remove();
  }
}

function filter_attrs(doc) {
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

const hidden_selector = [
  '[style*="display:none"]',
  '[style*="display: none"]',
  '[style*="visibility:hidden"]',
  '[style*="visibility: hidden"]',
  '[style*="opacity: 0.0"]',
  '[aria-hidden="true"]'
].join(',');

function filter_hidden(doc) {
  const elements = doc.querySelectorAll(hidden_selector);
  const doc_element = doc.documentElement;
  for(let element of elements) {
    if(element !== doc_element && doc_element.contains(element))
      unwrap(element);
  }
}

const hr_selector = [
  'hr + hr', // consecutive hrs
  'ul > hr', // hierarchy error
  'ol > hr' // hierarchy error
].join(',');

function filter_hrs(doc) {
  const elements = doc.querySelectorAll(hr_selector);
  for(let element of elements) {
    element.remove();
  }
}

function filter_small_images(doc) {
  const images = doc.querySelectorAll('img');
  for(let img of images) {
    if(img.width < 2 || img.height < 2)
      img.remove();
  }
}

function filter_sourceless_images(doc) {
  const images = doc.querySelectorAll('img');
  for(let img of images) {
    if(!img.hasAttribute('src') && !img.hasAttribute('srcset'))
      img.remove();
  }
}

function filter_invalid_anchors(doc) {
  const anchors = doc.querySelectorAll('a');
  for(let anchor of anchors) {
    if(is_invalid_anchor(anchor))
      anchor.remove();
  }
}

function is_invalid_anchor(anchor) {
  const href = anchor.getAttribute('href');
  return href && /^\s*https?:\/\/#/i.test(href);
}

function filter_leaves(doc) {
  if(!doc.body)
    return;

  const doc_element = doc.documentElement;
  const elements = doc.body.querySelectorAll('*');
  for(let element of elements) {
    if(doc_element.contains(element) && is_leaf(element))
      element.remove();
  }
}

function filter_tables(doc, limit) {
  const tables = doc.querySelectorAll('table');
  for(let i = 0, len = tables.length; i < len; i++) {
    const table = tables[i];
    if(is_single_col_table(table, limit))
      unwrap_single_col_table(table);
  }
}

function is_single_col_table(table, limit) {
  const rows = table.rows;
  const upper = Math.min(rows.length, limit);
  for(let i = 0; i < upper; i++) {
    if(!is_single_col_row(rows[i]))
      return false;
  }
  return true;
}

// TODO: for .. of?
function is_single_col_row(row) {
  const cells = row.cells;
  let num_non_empty = 0;
  for(let i = 0, len = cells.length; i < len; i++) {
    const cell = cells[i];
    if(!is_leaf(cell)) {
      if(++num_non_empty > 1)
        return false;
    }
  }

  return true;
}

// TODO: only pad if adjacent to text
// TODO: can i use for..of over table.rows?
function unwrap_single_col_table(table) {
  const rows = table.rows;
  const num_rows = rows.length;
  const parent = table.parentNode;
  const doc = table.ownerDocument;

  parent.insertBefore(doc.createTextNode(' '), table);
  for(let i = 0; i < num_rows; i++) {
    const row = rows[i];
    // TODO: if the cell is a leaf, skip it and do not add a paragraph
    for(let k = 0, clen = row.cells.length; k < clen; k++) {
      const cell = row.cells[k];
      insert_children_before(cell, table);
    }

    parent.insertBefore(doc.createElement('p'), table);
  }

  parent.insertBefore(doc.createTextNode(' '), table);
  table.remove();
}

const unwrappable_selector = [
  'abbr', 'acronym', 'article', 'aside', 'center', 'colgroup', 'data',
  'details', 'div', 'footer', 'header', 'help', 'hgroup', 'ilayer', 'insert',
  'layer', 'legend', 'main', 'mark', 'marquee', 'meter', 'multicol', 'nobr',
  'section', 'span', 'tbody', 'tfoot', 'thead', 'form', 'label', 'big',
  'blink', 'font', 'plaintext', 'small', 'tt'
].join(',');

function filter_unwrappables(doc) {
  const elements = doc.querySelectorAll(unwrappable_selector);
  for(let element of elements) {
    unwrap(element);
  }
}

const leaf_exceptions = {
  'area': 0, 'audio': 0, 'base': 0, 'col': 0, 'command': 0, 'br': 0,
  'canvas': 0, 'col': 0, 'hr': 0, 'iframe': 0, 'img': 0, 'input': 0,
  'keygen': 0, 'meta': 0, 'nobr': 0, 'param': 0, 'path': 0, 'source': 0,
  'sbg': 0, 'textarea': 0, 'track': 0, 'video': 0, 'wbr': 0
};

function is_leaf(node) {
  switch(node.nodeType) {
    case Node.ELEMENT_NODE:
      if(node.localName in leaf_exceptions)
        return false;
      for(let child = node.firstChild; child; child = child.nextSibling) {
        if(!is_leaf(child))
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

function filter_hairs(doc) {
  const it = doc.createNodeIterator(doc.documentElement,
    NodeFilter.SHOW_TEXT);
  for(let node = it.nextNode(); node; node = it.nextNode()) {
    const value = node.nodeValue;
    const modified = value.replace(/&(hairsp|#8082|#x200a);/ig, ' ');
    if(modified.length !== value.length)
      node.nodeValue = modified;
  }
}

function filter_noscripts(doc) {
  const elements = doc.querySelectorAll('noscript');
  for(let element of elements) {
    unwrap(element);
  }
}

function filter_frames(doc) {
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

function filter_figures(doc) {
  const figures = doc.querySelectorAll('figure');
  for(let figure of figures) {
    if(figure.childElementCount === 1)
      unwrap(figure);
  }
}

function trim_doc(doc) {
  const body = doc.body;
  if(!body)
    return;

  const first_child = body.firstChild;
  if(first_child) {
    trim_step(first_child, 'nextSibling');
    const last_child = body.lastChild;
    if(last_child && last_child !== first_child)
      trim_step(last_child, 'previousSibling');
  }
}

const trimmable_elements = {'br': 0, 'hr': 0, 'nobr': 0};

function can_trim(node) {
  return node && (node.localName in trimmable_elements ||
    (node.nodeType === Node.TEXT_NODE && !node.nodeValue.trim()));
}

function trim_step(start_node, prop_name) {
  let node = start_node;
  while(can_trim(node)) {
    let sibling = node[prop_name];
    node.remove();
    node = sibling;
  }
}

function unwrap(element, ref_node) {
  const target = ref_node || element;
  const parent = target.parentNode;
  if(!parent)
    throw new TypeError();
  const doc = element.ownerDocument;
  const prev_sib = target.previousSibling;
  if(prev_sib && prev_sib.nodeType === Node.TEXT_NODE)
    parent.insertBefore(doc.createTextNode(' '), target);
  insert_children_before(element, target);
  const next_sib = target.nextSibling;
  if(next_sib && next_sib.nodeType === Node.TEXT_NODE)
    parent.insertBefore(doc.createTextNode(' '), target);
  target.remove();
}

function insert_children_before(parent_node, ref_node) {
  const ref_parent = ref_node.parentNode;
  for(let node = parent_node.firstChild; node; node = parent_node.firstChild) {
    ref_parent.insertBefore(node, ref_node);
  }
}

function filter_single_item_lists(doc) {
  const list_selector = 'ul, ol, dl';
  const lists = doc.querySelectorAll(list_selector);
  for(let list of lists) {
    unwrap_single_item_list(doc, list);
  }
}

const list_item_names = {'li': 0, 'dt': 0, 'dd': 0};

function unwrap_single_item_list(doc, list) {
  const item = list.firstElementChild;
  if(!item)
    return;
  if(item.nextElementSibling)
    return;
  if(!(item.localName in list_item_names))
    return;

  if(!item.firstChild) {
    if(is_text_node(list.previousSibling) &&
      is_text_node(list.nextSibling)) {
      list.parentNode.replaceChild(doc.createTextNode(' '), list);
    } else {
      list.remove();
    }

    return;
  }

  if(is_text_node(list.previousSibling) &&
    is_text_node(item.firstChild)) {
    list.parentNode.insertBefore(doc.createTextNode(' '), list);
  }

  insert_children_before(item, list);

  if(is_text_node(list.nextSibling) &&
    is_text_node(list.previousSibling))
    list.parentNode.insertBefore(doc.createTextNode(' '), list);

  list.remove();
}

function is_text_node(node) {
  return node && node.nodeType === Node.TEXT_NODE;
}

this.scrub_dom = scrub_dom;
this.add_no_referrer = add_no_referrer;
this.filter_sourceless_images = filter_sourceless_images;
this.filter_invalid_anchors = filter_invalid_anchors;

}
