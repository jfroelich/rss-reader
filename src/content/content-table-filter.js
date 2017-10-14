// html table filtering library

'use strict';

// Dependencies
// assert.js
// element.js // for node_is_leaf
// transform-helpers.js // just for insert_children_before

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
function table_filter_transform_document(ancestor_element, row_scan_limit) {
  ASSERT(ancestor_element);

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
