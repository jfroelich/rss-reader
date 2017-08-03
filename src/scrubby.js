// See license.md
'use strict';

const scrubby = {};

scrubby.scrub = function(doc) {
  scrubby.filter_comments(doc);
  scrubby.filter_frames(doc);
  scrubby.filter_noscripts(doc);
  scrubby.filter_scripts(doc);
  scrubby.filter_blacklist(doc);
  scrubby.filter_hidden(doc);
  scrubby.adjust_block_inlines(doc);
  scrubby.filter_brs(doc);
  scrubby.filter_anchors(doc);
  scrubby.filter_formatting_anchors(doc);
  scrubby.filter_small_images(doc, 2);
  scrubby.filter_sourceless_imgs(doc);
  scrubby.filter_unwrappables(doc);
  scrubby.filter_figures(doc);
  scrubby.filter_hairspaces(doc);
  scrubby.condense_node_whitespace(doc);
  scrubby.filter_single_item_lists(doc);
  scrubby.filter_tables(doc, 20);
  scrubby.filter_leaves(doc);
  scrubby.filter_hrs(doc);
  scrubby.trim_document(doc);
  scrubby.filter_attrs(doc);
};

scrubby.filter_scripts = function(doc) {
  const elements = doc.querySelectorAll('script');
  for(const element of elements)
    element.remove();
};

scrubby.add_no_referrer = function(doc) {
  const anchors = doc.querySelectorAll('a');
  for(const anchor of anchors)
    anchor.setAttribute('rel', 'noreferrer');
};

// Looks for cases such as <a><p>text</p></a> and transforms them into
// <p><a>text</a></p>.
scrubby.adjust_block_inlines = function(doc) {
  const block_selector = 'blockquote, h1, h2, h3, h4, h5, h6, p';
  const inline_selector = 'a';
  const blocks = doc.querySelectorAll(block_selector);
  for(const block of blocks) {
    const ancestor = block.closest(inline_selector);
    if(ancestor && ancestor.parentNode) {
      ancestor.parentNode.insertBefore(block, ancestor);
      for(let node = block.firstChild; node; node = block.firstChild)
        ancestor.appendChild(node);
      block.appendChild(ancestor);
    }
  }
};

scrubby.condense_node_whitespace = function(doc) {
  const iterator = doc.createNodeIterator(doc.documentElement,
    NodeFilter.SHOW_TEXT);
  for(let node = iterator.nextNode(); node; node = iterator.nextNode()) {
    const value = node.nodeValue;
    if(value.length > 3 && !scrubby.is_whitespace_sensitive_descendant(node)) {
      const condensed_value = scrubby.condense_whitespace(value);
      if(condensed_value.length !== value.length)
        node.nodeValue = condensed_value;
    }
  }
};

// Find any sequence of 2 or more whitespace characters and replace with a
// single space
scrubby.condense_whitespace = function(string) {
  return string.replace(/\s{2,}/g, ' ');
};

// Returns true if the node lies within a whitespace sensitive element
scrubby.is_whitespace_sensitive_descendant = function(node) {
  return node.parentNode.closest('code, pre, ruby, textarea, xmp');
};

scrubby.filter_anchors = function(doc) {
  const anchors = doc.querySelectorAll('a');
  for(const anchor of anchors)
    if(scrubby.is_script_url(anchor.getAttribute('href')))
      scrubby.unwrap(anchor);
};

scrubby.is_script_url = function(url_string) {
  return url_string && url_string.length > 11 &&
    /^\s*javascript:/i.test(url_string);
};

scrubby.filter_formatting_anchors = function(doc) {
  const anchors = doc.querySelectorAll('a');
  for(const anchor of anchors)
    if(!anchor.hasAttribute('href') && !anchor.hasAttribute('name'))
      scrubby.unwrap(anchor);
};

// TODO: accept options parameter for custom blacklist that defaults to
// built in list
scrubby.filter_blacklist = function(doc) {
  const blacklist = [
    'applet', 'audio', 'base', 'basefont', 'bgsound', 'button', 'command',
    'datalist', 'dialog', 'embed', 'fieldset', 'frame', 'frameset', 'head',
    'iframe', 'input', 'isindex', 'link', 'math', 'meta',
    'object', 'output', 'optgroup', 'option', 'param', 'path', 'progress',
    'select', 'spacer', 'style', 'svg', 'textarea', 'title',
    'video', 'xmp'
  ];

  const selector = blacklist.join(',');
  const doc_element = doc.documentElement;
  const elements = doc.querySelectorAll(selector);
  for(const element of elements)
    if(doc_element.contains(element))
      element.remove();
};

scrubby.filter_brs = function(doc) {
  const elements = doc.querySelectorAll('br + br');
  for(const element of elements)
    element.remove();
};

scrubby.filter_comments = function(doc) {
  const iterator = doc.createNodeIterator(doc.documentElement,
    NodeFilter.SHOW_COMMENT);
  for(let node = iterator.nextNode(); node; node = iterator.nextNode()) {
    node.remove();
  }
};

// TODO: async merge frames into single document instead
scrubby.filter_frames = function(doc) {
  const frameset = doc.body;
  if(!frameset || frameset.localName !== 'frameset')
    return;

  const body = doc.createElement('body');
  const noframes = doc.querySelector('noframes');
  if(noframes) {
    for(let node = noframes.firstChild; node; node = noframes.firstChild)
      body.appendChild(node);
  } else {
    const error_node = doc.createTextNode('Unable to display framed document.');
    body.appendChild(error_node);
  }

  frameset.remove();
  doc.documentElement.appendChild(body);
};

scrubby.filter_attrs = function(doc) {
  const elements = doc.getElementsByTagName('*');
  for(const element of elements) {
    let local_name = element.localName;
    let attributes = element.attributes;
    if(!attributes || !attributes.length)
      continue;

    if(local_name === 'source') {
      for(let i = attributes.length - 1; i > -1; i--) {
        const attr_name = attributes[i].name;
        if(attr_name !== 'type' && attr_name !== 'srcset' &&
          attr_name !== 'sizes' && attr_name !== 'media' &&
          attr_name !== 'src')
          element.removeAttribute(attr_name);
      }
    } else if(local_name === 'a') {
      for(let i = attributes.length - 1; i > -1; i--) {
        const attr_name = attributes[i].name;
        if(attr_name !== 'href' && attr_name !== 'name' &&
          attr_name !== 'title')
          element.removeAttribute(attr_name);
      }
    } else if(local_name === 'iframe') {
      for(let i = attributes.length - 1; i > -1; i--) {
        const attr_name = attributes[i].name;
        if(attr_name !== 'src')
          element.removeAttribute(attr_name);
      }
    } else if(local_name === 'img') {
      for(let i = attributes.length - 1; i > -1; i--) {
        const attr_name = attributes[i].name;
        if(attr_name !== 'src' && attr_name !== 'alt' &&
          attr_name !== 'srcset' && attr_name !== 'title')
          element.removeAttribute(attr_name);
      }
    } else {
      for(let i = attributes.length - 1; i > -1; i--)
        element.removeAttribute(attributes[i].name);
    }
  }
};

scrubby.filter_hidden = function(doc) {
  const selector = [
    '[style*="display:none"]',
    '[style*="visibility:hidden"]',
    '[style*="opacity:0.0"]',
    '[aria-hidden="true"]'
  ].join(',');

  const elements = doc.querySelectorAll(selector);
  const doc_element = doc.documentElement;
  for(const element of elements)
    if(element !== doc_element && doc_element.contains(element))
      scrubby.unwrap(element);
};

scrubby.filter_hrs = function(doc) {
  const elements = doc.querySelectorAll('hr + hr, ul > hr, ol > hr');
  for(const element of elements)
    element.remove();
};

scrubby.filter_small_images = function(doc, min_dimension_value) {
  const images = doc.querySelectorAll('img');
  for(const img of images)
    if(img.width < min_dimension_value || img.height < min_dimension_value)
      img.remove();
};

scrubby.filter_sourceless_imgs = function(doc) {
  const images = doc.querySelectorAll('img');
  for(const image of images)
    if(!image.hasAttribute('src') && !image.hasAttribute('srcset'))
      image.remove();
};

scrubby.filter_invalid_anchors = function(doc) {
  const anchors = doc.querySelectorAll('a');
  for(const anchor of anchors)
    if(scrubby.is_invalid_anchor(anchor))
      anchor.remove();
};

scrubby.is_invalid_anchor = function(anchor) {
  const href = anchor.getAttribute('href');
  return href && /^\s*https?:\/\/#/i.test(href);
};

scrubby.filter_leaves = function(doc) {
  if(!doc.body)
    return;
  const doc_element = doc.documentElement;
  const elements = doc.body.querySelectorAll('*');
  for(const element of elements)
    if(doc_element.contains(element) && scrubby.is_leaf(element))
      element.remove();
};

scrubby.is_leaf_exception = function(element) {
  const exceptions = {
    'area': 0, 'audio': 0, 'base': 0, 'col': 0, 'command': 0, 'br': 0,
    'canvas': 0, 'col': 0, 'hr': 0, 'iframe': 0, 'img': 0, 'input': 0,
    'keygen': 0, 'meta': 0, 'nobr': 0, 'param': 0, 'path': 0, 'source': 0,
    'sbg': 0, 'textarea': 0, 'track': 0, 'video': 0, 'wbr': 0
  };
  return element.localName in exceptions;
};

scrubby.is_leaf = function(node) {
  switch(node.nodeType) {
    case Node.ELEMENT_NODE:
      if(scrubby.is_leaf_exception(node))
        return false;
      for(let child = node.firstChild; child; child = child.nextSibling)
        if(!scrubby.is_leaf(child))
          return false;
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

scrubby.filter_tables = function(doc, row_scan_limit) {
  const tables = doc.querySelectorAll('table');
  for(const table of tables)
    if(scrubby.is_single_column_table(table, row_scan_limit))
      scrubby.unwrap_single_column_table(table);
};

scrubby.is_single_column_table = function(table, row_scan_limit) {
  const rows = table.rows;
  const safe_row_scan_limit = Math.min(rows.length, row_scan_limit);
  for(let i = 0; i < safe_row_scan_limit; i++)
    if(!scrubby.is_single_column_row(rows[i]))
      return false;
  return true;
};

scrubby.is_single_column_row = function(row) {
  const cells = row.cells;
  let non_empty_cell_count = 0;
  for(let i = 0, len = cells.length; i < len; i++)
    if(!scrubby.is_leaf(cells[i]) && ++non_empty_cell_count > 1)
      return false;
  return true;
};

scrubby.unwrap_single_column_table = function(table) {
  const rows = table.rows;
  const row_count = rows.length;
  const parent = table.parentNode;
  const doc = table.ownerDocument;

  parent.insertBefore(doc.createTextNode(' '), table);
  for(let i = 0; i < row_count; i++) {
    const row = rows[i];
    // TODO: if the cell is a leaf, skip iterator and do not add a paragraph
    for(let k = 0, clen = row.cells.length; k < clen; k++) {
      const cell = row.cells[k];
      scrubby.insert_children_before(cell, table);
    }

    parent.insertBefore(doc.createElement('p'), table);
  }

  parent.insertBefore(doc.createTextNode(' '), table);
  table.remove();
};

scrubby.filter_unwrappables = function(doc) {
  const selector = [
    'abbr', 'acronym', 'article', 'aside', 'center', 'colgroup', 'data',
    'details', 'div', 'footer', 'header', 'help', 'hgroup', 'ilayer',
    'insert', 'layer', 'legend', 'main', 'mark', 'marquee', 'meter',
    'multicol', 'nobr', 'section', 'span', 'tbody', 'tfoot', 'thead', 'form',
    'label', 'big', 'blink', 'font', 'plaintext', 'small', 'tt'
  ].join(',');
  const elements = doc.querySelectorAll(selector);
  for(const element of elements)
    scrubby.unwrap(element);
};

scrubby.filter_hairspaces = function(doc) {
  const iterator = doc.createNodeIterator(
    doc.documentElement, NodeFilter.SHOW_TEXT);
  for(let node = iterator.nextNode(); node; node = iterator.nextNode()) {
    const value = node.nodeValue;
    const modified_value = value.replace(/&(hairsp|#8082|#x200a);/ig, ' ');
    if(modified_value.length !== value.length)
      node.nodeValue = modified_value;
  }
};

scrubby.filter_noscripts = function(doc) {
  const elements = doc.querySelectorAll('noscript');
  for(const element of elements)
    scrubby.unwrap(element);
};

scrubby.filter_figures = function(doc) {
  const figures = doc.querySelectorAll('figure');
  for(const figure of figures)
    if(figure.childElementCount === 1)
      scrubby.unwrap(figure);
};

scrubby.trim_document = function(doc) {
  if(!doc.body)
    return;
  const first_child = doc.body.firstChild;
  if(first_child) {
    scrubby.trim_doc_step(first_child, 'nextSibling');
    const last_child = doc.body.lastChild;
    if(last_child && last_child !== first_child)
      scrubby.trim_doc_step(last_child, 'previousSibling');
  }
};

scrubby.trim_doc_step = function(starting_node, edge) {
  let node = starting_node;
  while(scrubby.is_trimmable_node(node)) {
    const sibling = node[edge];
    node.remove();
    node = sibling;
  }
};

scrubby.is_trimmable_node = function(node) {
  const elements = ['br', 'hr', 'nobr'];
  return node && (elements.includes(node.localName) ||
    (node.nodeType === Node.TEXT_NODE && !node.nodeValue.trim()));
};

scrubby.unwrap = function(element, reference_node) {
  const target = reference_node || element;
  const parent = target.parentNode;

  if(!parent)
    throw new TypeError('element missing parent element');

  const doc = element.ownerDocument;
  const prev_sibling = target.previousSibling;
  if(prev_sibling && prev_sibling.nodeType === Node.TEXT_NODE)
    parent.insertBefore(doc.createTextNode(' '), target);

  scrubby.insert_children_before(element, target);

  const next_sibling = target.nextSibling;
  if(next_sibling && next_sibling.nodeType === Node.TEXT_NODE)
    parent.insertBefore(doc.createTextNode(' '), target);
  target.remove();
};

scrubby.insert_children_before = function(parent_node, reference_node) {
  const ref_parent = reference_node.parentNode;
  for(let node = parent_node.firstChild; node; node = parent_node.firstChild)
    ref_parent.insertBefore(node, reference_node);
};

scrubby.filter_single_item_lists = function(doc) {
  const list_elements = doc.querySelectorAll('ul, ol, dl');
  for(const list_element of list_elements)
    scrubby.filter_single_item_list(doc, list_element);
};

// Unwraps single item or empty list elements
scrubby.filter_single_item_list = function(doc, list) {
  const list_parent = list.parentNode;
  if(!list_parent)
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
    if(scrubby.is_text_node(list.previousSibling))
      list_parent.insertBefore(doc.createTextNode(' '), list);
    for(let node = list.firstChild; node; node = list.firstChild)
      list_parent.insertBefore(node, list);
    if(scrubby.is_text_node(list.nextSibling))
      list_parent.insertBefore(doc.createTextNode(' '), list);
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
    if(scrubby.is_text_node(list.previousSibling) &&
      scrubby.is_text_node(list.nextSibling))
      list_parent.replaceChild(doc.createTextNode(' '), list);
    else
      list.remove();
    return;
  }

  // The list has one child element with one or more child nodes. Move the
  // child nodes to before the list and then remove iterator. Add padding if needed.
  if(scrubby.is_text_node(list.previousSibling) &&
    scrubby.is_text_node(item.firstChild))
    list_parent.insertBefore(doc.createTextNode(' '), list);

  scrubby.insert_children_before(item, list);

  if(scrubby.is_text_node(list.nextSibling) &&
    scrubby.is_text_node(list.previousSibling))
    list_parent.insertBefore(doc.createTextNode(' '), list);

  list.remove();
};

scrubby.is_text_node = function(node) {
  return node && node.nodeType === Node.TEXT_NODE;
};
