// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

{ // Begin file block scope

// @param limit max number of rows to inspect
function filterTableElements(document, limit) {
  const tables = document.querySelectorAll('table');
  for(let i = 0, len = tables.length; i < len; i++) {
    const table = tables[i];
    if(isSingleColTable(table, limit)) {
      unwrapSingleColTable(table);
    }
  }
}

// A table is a single column unless it has any non-single column rows in
// the first couple of rows
function isSingleColTable(table, limit) {
  const rows = table.rows;
  const upper = Math.min(rows.length, limit);
  for(let i = 0; i < upper; i++) {
    if(!isSingleColRow(rows[i])) {
      return false;
    }
  }
  return true;
}

// A row is a single column when it is either empty or contains no more than
// one non-leaf cell.
// TODO: the logic here could be simplified. Maybe just use a boolean
// instead of a counter.
function isSingleColRow(row) {
  const cells = row.cells;
  let nonEmptyCount = 0;
  for(let i = 0, len = cells.length; i < len; i++) {
    const cell = cells[i];
    if(isLeafNode(cell)) {
      // If it is a leaf node, it could still be a single column row element
    } else {
      // If it is a non leaf node, it is no longer a single column row element
      // if this is the 2nd non-leaf found.
      nonEmptyCount++;
      if(nonEmptyCount === 1) {
        // This is the first non-leaf. Still could be single column
      } else {
        // This is the second non-leaf. Can't be single column.
        // console.debug('Not a single column:', row.outerHTML);
        return false;
      }
    }
  }

  return true;
}

// isSingleColTable does not guarantee that all rows are single column, so
// we still iterate all cells per row, even though most of the time this
// is just one cell.
function unwrapSingleColTable(table) {
  const rows = table.rows;
  const numRows = rows.length;
  const tableParent = table.parentNode;

  // TODO: only pad if adjacent to text node

  tableParent.insertBefore(document.createTextNode(' '), table);

  for(let i = 0; i < numRows; i++) {
    const row = rows[i];

    // TODO: if the cell is a leaf node, skip it and do not create
    // a new paragraph.
    for(let k = 0, clen = row.cells.length; k < clen; k++) {
      const cell = row.cells[k];
      insertChildrenBefore(cell, table);
    }

    tableParent.insertBefore(document.createElement('p'), table);
  }

  tableParent.insertBefore(document.createTextNode(' '), table);
  table.remove();
}

this.filterTableElements = filterTableElements;

} // End file block scope
