// See license.md
'use strict';

{ // Begin file block scope

function condense_html_document(doc) {
  remove_comment_nodes(doc);

  // TODO: test, these are new
  rename_elements(doc, 'strong', 'b');
  rename_elements(doc, 'em', 'i');

  unwrap_captionless_figure_elements(doc);

  // Unwrap semantic container sections
  unwrap_elements(doc.body, 'article, aside, footer, header, main, section');
  // Unwrap table sections
  unwrap_elements(doc.body, 'colgroup, hgroup, multicol, tbody, tfoot, thead');
  // Unwrap generic containers
  unwrap_elements(doc.body, 'div, ilayer, layer');

  // TODO: this needs some cleanup, more organization
  const misc_selector = [
    'abbr', 'acronym', 'center', 'data', 'details', 'help', 'insert', 'legend',
    'mark', 'marquee', 'meter', 'nobr', 'span', 'big', 'blink',
    'font', 'plaintext', 'small', 'tt'
  ].join(',');
  unwrap_elements(doc.body, misc_selector);

  unwrap_single_item_lists(doc);
  unwrap_single_column_tables(doc, 20);
  remove_leaf_nodes(doc);

  condense_node_whitespace(doc);
  trim_document(doc);
}

function remove_comment_nodes(doc) {
  const iterator = doc.createNodeIterator(doc.documentElement,
    NodeFilter.SHOW_COMMENT);
  for(let node = iterator.nextNode(); node; node = iterator.nextNode())
    node.remove();
}

// Unwrap figure elements that merely wrap an image without adding a caption
function unwrap_captionless_figure_elements(doc) {
  if(!doc.body)
    return;
  const figures = doc.body.querySelectorAll('figure');
  for(const figure of figures)
    if(figure.childElementCount === 1)
      unwrap_element(figure);
}

function rename_elements(doc, old_element_name, new_element_name) {
  const elements = doc.querySelectorAll(old_element_name);
  for(const element of elements)
    rename_element(element, new_element_name);
}

// NOTE: not optimized for live document modification
function rename_element(element, new_element_name) {
  if(!element.parentNode)
    return;
  const new_element = element.ownerDocument.createElement(new_element_name);
  // Move the children from the old element to the new. Note this temporarily
  // detaches the children from the document.
  for(let node = element.firstChild; node; node = element.firstChild)
    new_element.appendChild(node);
  // Append the new element along with its children, remove the old element
  element.parentNode.replaceChild(new_element, element);
}

function unwrap_elements(parent_element, selector) {
  if(parent_element && selector) {
    const elements = parent_element.querySelectorAll(selector);
    for(const element of elements)
      unwrap_element(element);
  }
}

function remove_leaf_nodes(doc) {
  if(!doc.body)
    return;
  const doc_element = doc.documentElement;
  const elements = doc.body.querySelectorAll('*');
  for(const element of elements)
    if(doc_element.contains(element) && is_leaf_node(element))
      element.remove();
}

// Recursive
function is_leaf_node(node) {
  switch(node.nodeType) {
    case Node.ELEMENT_NODE:
      if(is_leaf_exception(node))
        return false;
      for(let child = node.firstChild; child; child = child.nextSibling)
        if(!is_leaf_node(child))
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
}

function is_leaf_exception(element) {
  const exceptions = [
    'area', 'audio', 'base', 'col', 'command', 'br', 'canvas', 'col', 'hr',
    'iframe', 'img', 'input', 'keygen', 'meta', 'nobr', 'param', 'path',
    'source', 'sbg', 'textarea', 'track', 'video', 'wbr'
  ];
  return exceptions.includes(element.localName);
}

function unwrap_single_column_tables(doc, row_scan_limit) {
  const tables = doc.querySelectorAll('table');
  for(const table of tables)
    if(is_single_column_table(table, row_scan_limit))
      unwrap_single_column_table(table);
}

function is_single_column_table(table, row_scan_limit) {
  const rows = table.rows;
  const safe_row_scan_limit = Math.min(rows.length, row_scan_limit);
  for(let i = 0; i < safe_row_scan_limit; i++)
    if(!is_single_column_row(rows[i]))
      return false;
  return true;
}

function is_single_column_row(row) {
  const cells = row.cells;
  let non_empty_cell_count = 0;
  for(let i = 0, len = cells.length; i < len; i++)
    if(!is_leaf_node(cells[i]) && ++non_empty_cell_count > 1)
      return false;
  return true;
}

function unwrap_single_column_table(table) {
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
      insert_children_before(cell, table);
    }

    parent.insertBefore(doc.createElement('p'), table);
  }

  parent.insertBefore(doc.createTextNode(' '), table);
  table.remove();
}

function unwrap_single_item_lists(doc) {
  const list_elements = doc.querySelectorAll('ul, ol, dl');
  for(const list_element of list_elements)
    unwrap_single_item_list(doc, list_element);
}

// Unwraps single item or empty list elements
function unwrap_single_item_list(doc, list) {
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
    if(is_text_node(list.previousSibling))
      list_parent.insertBefore(doc.createTextNode(' '), list);
    for(let node = list.firstChild; node; node = list.firstChild)
      list_parent.insertBefore(node, list);
    if(is_text_node(list.nextSibling))
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
    if(is_text_node(list.previousSibling) &&
      is_text_node(list.nextSibling))
      list_parent.replaceChild(doc.createTextNode(' '), list);
    else
      list.remove();
    return;
  }

  // The list has one child element with one or more child nodes. Move the
  // child nodes to before the list and then remove iterator. Add padding if needed.
  if(is_text_node(list.previousSibling) &&
    is_text_node(item.firstChild))
    list_parent.insertBefore(doc.createTextNode(' '), list);

  insert_children_before(item, list);

  if(is_text_node(list.nextSibling) &&
    is_text_node(list.previousSibling))
    list_parent.insertBefore(doc.createTextNode(' '), list);

  list.remove();
}

function is_text_node(node) {
  return node && node.nodeType === Node.TEXT_NODE;
}

function condense_node_whitespace(doc) {
  const iterator = doc.createNodeIterator(doc.documentElement,
    NodeFilter.SHOW_TEXT);
  for(let node = iterator.nextNode(); node; node = iterator.nextNode()) {
    const value = node.nodeValue;
    if(value.length > 3 && !is_whitespace_sensitive_descendant(node)) {
      const condensed_value = condense_whitespace(value);
      if(condensed_value.length !== value.length)
        node.nodeValue = condensed_value;
    }
  }
}

// Returns true if the node lies within a whitespace sensitive element
function is_whitespace_sensitive_descendant(node) {
  return node.parentNode.closest('code, pre, ruby, textarea, xmp');
}

// Find any sequence of 2 or more whitespace characters and replace with a
// single space
function condense_whitespace(string) {
  return string.replace(/\s{2,}/g, ' ');
}

// Remove whitespace and whitespace-like content from the start and end of
// the document's body.
function trim_document(doc) {
  if(!doc.body)
    return;
  const first_child = doc.body.firstChild;
  if(first_child) {
    trim_doc_step(first_child, 'nextSibling');
    const last_child = doc.body.lastChild;
    if(last_child && last_child !== first_child)
      trim_doc_step(last_child, 'previousSibling');
  }
}

function trim_doc_step(starting_node, edge) {
  let node = starting_node;
  while(is_trimmable_node(node)) {
    const sibling = node[edge];
    node.remove();
    node = sibling;
  }
}

function is_trimmable_node(node) {
  const elements = ['br', 'hr', 'nobr'];
  return node && (elements.includes(node.localName) ||
    (node.nodeType === Node.TEXT_NODE && !node.nodeValue.trim()));
}

this.condense_html_document = condense_html_document;

} // End file block scope
