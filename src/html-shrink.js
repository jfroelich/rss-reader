(function(exports) {
'use strict';

function html_shrink(doc, copy_attrs_on_rename, row_scan_limit) {
  remove_comment_nodes(doc.documentElement);

  const body_element = doc.body;
  if(!body_element)
    return;

  // Use shorter names for common elements
  rename_elements(body_element, 'strong', 'b', copy_attrs_on_rename);
  rename_elements(body_element, 'em', 'i', copy_attrs_on_rename);

  unwrap_captionless_figure_elements(body_element);

  // Unwrap semantic container sections
  unwrap_elements(body_element,
    'article, aside, footer, header, main, section');
  // Unwrap table sections
  unwrap_elements(body_element,
    'colgroup, hgroup, multicol, tbody, tfoot, thead');
  // Unwrap generic containers
  unwrap_elements(body_element, 'div, ilayer, layer');

  unwrap_single_item_lists(body_element);
  unwrap_single_column_tables(body_element, row_scan_limit);
  remove_leaf_nodes(body_element);

  condense_text_nodes_whitespace(doc.documentElement);
  trim_document(body_element);
}

function remove_comment_nodes(ancestor_element) {
  const doc = ancestor_element.ownerDocument;
  const iterator = doc.createNodeIterator(ancestor_element,
    NodeFilter.SHOW_COMMENT);
  for(let node = iterator.nextNode(); node; node = iterator.nextNode())
    node.remove();
}

// Unwrap figure elements that merely wrap an image without adding a caption
function unwrap_captionless_figure_elements(ancestor_element) {
  if(ancestor_element) {
    const figure_elements = ancestor_element.querySelectorAll('figure');
    for(const figure_element of figure_elements)
      if(figure_element.childElementCount === 1)
        unwrap_element(figure_element);
  }
}

function remove_leaf_nodes(ancestor_element) {
  if(ancestor_element) {
    const doc_element = ancestor_element.ownerDocument.documentElement;
    const elements = ancestor_element.querySelectorAll('*');
    for(const element of elements)
      if(doc_element.contains(element) && node_is_leaf(element))
        element.remove();
  }
}

// Recursive
function node_is_leaf(node) {
  switch(node.nodeType) {
    case Node.ELEMENT_NODE:
      if(element_is_leaf_exception(node))
        return false;
      for(let child = node.firstChild; child; child = child.nextSibling)
        if(!node_is_leaf(child))
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

function element_is_leaf_exception(element) {
  const exceptions = [
    'area', 'audio', 'base', 'col', 'command', 'br', 'canvas', 'col', 'hr',
    'iframe', 'img', 'input', 'keygen', 'meta', 'nobr', 'param', 'path',
    'source', 'sbg', 'textarea', 'track', 'video', 'wbr'
  ];
  return exceptions.includes(element.localName);
}

function unwrap_single_column_tables(ancestor_element, row_scan_limit) {
  const tables = ancestor_element.querySelectorAll('table');
  for(const table of tables)
    if(table_is_single_column(table, row_scan_limit))
      unwrap_single_column_table(table);
}

function table_is_single_column(table, row_scan_limit) {
  const rows = table.rows;
  const safe_row_scan_limit = Math.min(rows.length, row_scan_limit);
  for(let i = 0; i < safe_row_scan_limit; i++)
    if(!row_is_single_column(rows[i]))
      return false;
  return true;
}

function row_is_single_column(row) {
  const cells = row.cells;
  let non_empty_cell_count = 0;
  for(let i = 0, len = cells.length; i < len; i++)
    if(!node_is_leaf(cells[i]) && ++non_empty_cell_count > 1)
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

function unwrap_single_item_lists(ancestor_element) {
  const list_elements = ancestor_element.querySelectorAll('ul, ol, dl');
  for(const list_element of list_elements)
    unwrap_single_item_list(ancestor_element, list_element);
}

// Unwraps single item or empty list elements
function unwrap_single_item_list(ancestor_element, list) {
  const list_parent = list.parentNode;
  if(!list_parent)
    return;
  const doc = ancestor_element.ownerDocument;
  const item = list.firstElementChild;

  // If the list has no child elements then move its child nodes out of the
  // list and remove iterator
  // TODO: this is unexpected, probably should be separate function
  if(!item) {
    // If iterator is just <list>...<item/>...<list> then remove
    if(!list.firstChild) {
      list.remove();
      return;
    }
    // The list has no child elements, but the list has one or more child
    // nodes. Move the nodes to before the list. Add padding if needed.
    if(node_is_text(list.previousSibling))
      list_parent.insertBefore(doc.createTextNode(' '), list);
    for(let node = list.firstChild; node; node = list.firstChild)
      list_parent.insertBefore(node, list);
    if(node_is_text(list.nextSibling))
      list_parent.insertBefore(doc.createTextNode(' '), list);
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
    if(node_is_text(list.previousSibling) && node_is_text(list.nextSibling))
      list_parent.replaceChild(doc.createTextNode(' '), list);
    else
      list.remove();
    return;
  }

  // The list has one child element with one or more child nodes. Move the
  // child nodes to before the list and then remove iterator. Add padding.
  if(node_is_text(list.previousSibling) && node_is_text(item.firstChild))
    list_parent.insertBefore(doc.createTextNode(' '), list);
  insert_children_before(item, list);
  if(node_is_text(list.nextSibling) && node_is_text(list.previousSibling))
    list_parent.insertBefore(doc.createTextNode(' '), list);
  list.remove();
}

function node_is_text(node) {
  return node && node.nodeType === Node.TEXT_NODE;
}

function condense_text_nodes_whitespace(ancestor_element) {
  const doc = ancestor_element.ownerDocument;
  const iterator = doc.createNodeIterator(ancestor_element,
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
function is_whitespace_sensitive_descendant(text_node) {
  // The closest method only exists on elements, so use the text node's
  // parent element. The closest method also tests against the element itself,
  // so the parent element is checked.
  const parent_element = text_node.parentNode;
  return parent_element.closest('code, pre, ruby, textarea, xmp');
}

// Find any sequence of 2 or more whitespace characters and replace with a
// single space
function condense_whitespace(string) {
  return string.replace(/\s{2,}/g, ' ');
}

// Remove whitespace and whitespace-like content from the start and end of
// the document's body.
function trim_document(body_element) {
  if(!body_element)
    return;
  const first_child = body_element.firstChild;
  if(first_child) {
    trim_doc_step(first_child, 'nextSibling');
    const last_child = body_element.lastChild;
    if(last_child && last_child !== first_child)
      trim_doc_step(last_child, 'previousSibling');
  }
}

function trim_doc_step(starting_node, edge) {
  let node = starting_node;
  while(node_is_trimmable(node)) {
    const sibling = node[edge];
    node.remove();
    node = sibling;
  }
}

// TODO: return true for node_is_leaf?
function node_is_trimmable(node) {
  const elements = ['br', 'hr', 'nobr'];
  return node && (elements.includes(node.localName) ||
    (node.nodeType === Node.TEXT_NODE && !node.nodeValue.trim()));
}

exports.html_shrink = html_shrink;

}(this));


/*

# TODO

* Replace entities with single unicode character where possible in order
to shrink document size? Part of the challenge is how to get entities when
node.nodeValue auto encodes
* Are there other elements with abbreviated versions like strong/em?
* For isSingleColumnRow, check if row.cells supports for..of
* For unwrapSingleColumnTable, check if table.rows supports for..of
* For unwrapSingleColumnTable, only pad if adjacent to text
* Remove processing instructions and doc type stuff
* Can shrink some attribute values, like for image width change 100px to 100,
because units are implied in many places
* Can reduce the size of attribute values by trimming them
* Can remove attributes that do not have values that are non-unary attributes
* Can remove attributes that equal the default values
* Preprocess all entities like nbsp, and convert each one into its numeric
equivalent. On average the numeric entities use fewer characters. And possibly
go further given that it is utf8 encoding, do things like convert copy into
actual copyright utf character. Also consider the option to use whichever has
fewer characters, the named encoding or the numeric encoding. Also consider
working with a TextEncoder/Decoder api if appropriate. Also see https://github.com/mathiasbynens/he for ideas. Also, there is an issue with
the fact that condense takes a document but this would be maybe be easier on
raw text? See also https://github.com/kangax/html-minifier with its option
to use unicode char when possible
* If an image is a known square with equal attribute values, can maybe remove
one of the dimensions?
* actually, just take a look at https://github.com/kangax/html-minifier and
think about some similar options

# TODO: Try and improve the table unwrapping algorithm

It seems to be missing hacker news blog comments section. It might be that the
first column is not empty, and only later becomes empty because of other
sanitization. But I feel like I should somehow be picking this up in the
general case and unwrapping such a table. See
https://news.ycombinator.com/item?id=14942570 as an example of the failure.

Specifically I think it is not counting the following as an empty cell:

&lt;table&gt;
&lt;tr&gt;
  &lt;td class="ind"&gt;&lt;img src="s.gif" height="1" width="0"&gt;&lt;/td&gt;
  &lt;td&gt;asdf content&lt;/td&gt;
&lt;/tr&gt;
&lt;/table&gt;

The image gets filtered later, which is why I am seeing the empty cell. This is
from before that image gets filtered. It would be nice if the is empty could
also pick up the spacer image and still treat it as empty.

This may just get fixed if i fix the remove tiny images stuff

# TODO: more table unwrap improvement ideas

Rather than insert spaces and paragraphs, create paragraphs and move cell contents into them, then insert the paragraphs.

Check if there is only one child that is a paragraph and if so maybe just use that instead of a new paragraph

This means i do not think i can use insertChildrenBefore, so i have to write the lower level moves, or i have to think of how to reorient the helper function so that is more abstract. i think the issue is that it is not as flexible as say insertAdjacentHTML's location parameter. so maybe i just need an entirely different function. maybe use the moveChildNodes function, but pass in a new parameter that suppresses the use of the document fragment and just does the straight appendChild call per node.

Either that, or I should have two functions, moveChildNodesUsingFragment, and moveChildNodes. or maybe i make a function accept a parent element, and if i want to use a fragment, pass that in

# TODO: improve leaf filtering performance

Figure out a way to avoid re-trimming text nodes. I feel like the bulk of the time is spent doing this. I need to measure first.

Because DOM modification is expensive, this tries to minimize the number of elements removed by only removing the shallowest elements. For example, when processing , the naive approach would perform two operations, first removing the innerleaf and then the outerleaf. The outerleaf is also a leaf because upon removing the innerleaf, it then satisfies the is-leaf condition. Instead, this recognizes this situation, and only removes outerleaf. The cost of doing this is that the is-leaf function is recursive and nested elements are revisited.

This still iterates over all of the elements, because using querySelectorAll is faster than walking. As a result, this also checks at each step of the iteration whether the current element is still attached to the document, and avoids removing elements that were detached by virtue of an ancestor being detached in a prior iteration step.

Only iterate elements within the body element. This prevents the body element itself and the document element from also being iterated and therefore identified as leaves and therefore removed in the case of an empty document.

doc_element.contains(doc_element) returns true because doc_element is an inclusive descendant of doc_element as defined in the spec. This is why doc_element itself can also be removed if this iterated over all elements and not just those within the body.

contains is checked first because it is a native method that is faster than is_leaf_node, so this minimizes the calls to is_leaf_node

This is not currently using for..of to iterate over the node list because of a V8 deoptimization warning (something about a try catch), my guess is that it has to do with how it is desugared

Think of a better way to avoid revisiting nodes


# TODO: improve criteria for leaf filtering

Do not always filter empty table cells. Cells in some cases are important to
the structure of the table even if empty.

But if I implement this in isLeaf, be wary of the fact that the single column
table transformation also does leaf checking and does want to know if a cell is
empty.

Therefore, probably need to a parameter to is leaf that determines whether or
not an empty cell should be considered a leaf.

*/
