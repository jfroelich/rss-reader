// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

{ // BEGIN FILE SCOPE

function filterSingleCellTables(document) {

  // NOTE: this check is a guard left over from an old approach and
  // may no longer be necessary
  if(!document.body) {
    return;
  }

  const tables = document.body.querySelectorAll('table');
  for(let i = 0, len = tables.length, table, cell; i < len; i++) {
    table = tables[i];
    cell = getTableSingleCell(table);
    if(cell) {
      unwrapSingleCellTable(table, cell);
    }
  }
}

this.filterSingleCellTables = filterSingleCellTables;

// Returns the single cell of a table iff it is a single cell table,
// which means it has only 1 row and 1 column
function getTableSingleCell(table) {
  const rows = table.rows;
  let cell = null;
  let cells = null;

  if(rows.length === 1) {
    cells = rows[0].cells;
    if(cells.length === 1) {
      cell = cells[0];
    }
  }

  return cell;
}

function unwrapSingleCellTable(table, cell) {
  const parent = table.parentElement;
  const nextSibling = table.nextSibling;
  const moveNode = nextSibling ? parent.insertBefore : parent.appendChild;
  for(let node = cell.firstChild; node; node = cell.firstChild) {
    moveNode(node, nextSibling);
  }
  table.remove();
}

} // END FILE SCOPE
