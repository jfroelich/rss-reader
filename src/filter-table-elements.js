// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

{ // Begin file block scope

// @param limit max n rows to inspect
this.filter_table_elements = function(document, limit) {
  const tables = document.querySelectorAll('table');
  for(let i = 0, len = tables.length; i < len; i++) {
    const table = tables[i];
    if(is_single_col_table(table, limit)) {
      unwrap_single_column_table(table);
    }
  }
};

// A table is a single column unless it has any non-single column rows in
// the first couple of rows
function is_single_col_table(table, limit) {
  const rows = table.rows;
  const upper = Math.min(rows.length, limit);
  for(let i = 0; i < upper; i++) {
    if(!is_single_col_row(rows[i])) {
      return false;
    }
  }
  return true;
}

// A row is a single column when it is either empty or contains no more than
// one non-leaf cell.
// TODO: the logic here could be simplified. Maybe just use a boolean
// instead of a counter.
function is_single_col_row(rowElement) {
  const cells = rowElement.cells;

  let nonEmptyCount = 0;
  for(let i = 0, len = cells.length; i < len; i++) {
    let cell = cells[i];
    if(is_leaf_node(cell)) {
      // If it is a leaf node, it could still be a single column row element
    } else {
      // If it is a non leaf node, it is no longer a single column row element
      // if this is the 2nd non-leaf found.
      nonEmptyCount++;
      if(nonEmptyCount === 1) {
        // This is the first non-leaf. Still could be single column
      } else {
        // This is the second non-leaf. Can't be single column.
        // console.debug('Not a single column:', rowElement.outerHTML);
        return false;
      }
    }
  }

  return true;
}

// is_single_col_table does not guarantee that all rows are single column, so
// we still iterate all cells per row, even though most of the time this
// is just one cell.
function unwrap_single_column_table(table) {
  const rows = table.rows;
  const numRows = rows.length;
  const tableParent = table.parentNode;

  tableParent.insertBefore(document.createTextNode(' '), table);

  for(let i = 0; i < numRows; i++) {
    let row = rows[i];

    // TODO: if the cell is a leaf node, skip it and do not create
    // a new paragraph.
    for(let k = 0, clen = row.cells.length; k < clen; k++) {
      let cell = row.cells[k];
      insert_children_before(cell, table);
    }

    tableParent.insertBefore(document.createElement('p'), table);
  }

  tableParent.insertBefore(document.createTextNode(' '), table);
  table.remove();
}

} // End file block scope
