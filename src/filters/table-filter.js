// html table filtering library

'use strict';

// Dependencies
// assert.js
// element.js // for node_is_leaf
// transform-helpers.js // just for insert_children_before


/*

* For isSingleColumnRow, check if row.cells supports for..of
* For unwrapSingleColumnTable, check if table.rows supports for..of
* For unwrapSingleColumnTable, only pad if adjacent to text

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

*/


// NOTE: this cannot assume that th, tbody, etc have been filtered. Perhaps
// that requirement should be made explicit, or should be added as functionality
// here (and not as a part of the general unwrap_unwrappables thing). This
// is probably something I should revisit.

// Scan the descendants of the ancestor element for table elements. For each
// table, if a table is a basic single-column table, then transform the content
// of the table into a series of paragraphs and remove the table. Otherwise,
// leave the table as is.
//
// @param row_scan_limit {Number} the maximum number of rows to scan when
// determining whether a table is a single column table
function table_filter(doc, row_scan_limit) {
  ASSERT(doc);

  if(!doc.body) {
    return;
  }

  const ancestor_element = doc.body;

  const tables = ancestor_element.querySelectorAll('table');
  for(const table of tables) {
    if(table_filter_is_single_column_table(table, row_scan_limit))
      table_filter_unwrap_single_column_table(table);
  }
}

function table_filter_is_single_column_table(table, row_scan_limit) {
  const rows = table.rows;
  const safe_limit = Math.min(rows.length, row_scan_limit);
  for(let i = 0; i < safe_limit; i++) {
    if(!table_filter_is_single_column_row(rows[i]))
      return false;
  }
  return true;
}

function table_filter_is_single_column_row(row) {
  const cells = row.cells;
  let non_empty_cell_count = 0;

  // TODO: does row.cells support for..of?

  for(let i = 0, len = cells.length; i < len; i++) {

    // TODO: simplify. I want to be able to look at this and immediately
    // understand the condition.
    if(!node_is_leaf(cells[i]) && ++non_empty_cell_count > 1) {
      return false;
    }

  }

  return true;
}

function table_filter_unwrap_single_column_table(table) {
  const rows = table.rows;
  const row_count = rows.length;
  const parent = table.parentNode;
  const doc = table.ownerDocument;

  parent.insertBefore(doc.createTextNode(' '), table);

  // TODO: does table.rows support for..of?

  for(let i = 0; i < row_count; i++) {
    const row = rows[i];

    // TODO: if the cell is a leaf, skip iterator and do not add a paragraph
    for(let j = 0, clen = row.cells.length; j < clen; j++) {
      const cell = row.cells[j];
      insert_children_before(cell, table);
    }

    parent.insertBefore(doc.createElement('p'), table);
  }

  parent.insertBefore(doc.createTextNode(' '), table);
  table.remove();
}
