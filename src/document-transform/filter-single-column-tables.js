// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

// NOTE: under initial development

'use strict';

{ // BEGIN FILE SCOPE

function filterSingleColumnTables(document) {
  const tables = document.querySelectorAll('table');
  const numTables = tables.length;
  for(let i = 0, table; i < numTables; i++) {
    table = tables[i];
    if(isSingleColumnTable(table)) {
      transformSingleColumnTable(table);
    }
  }
}

this.filterSingleColumnTables = filterSingleColumnTables;

// NOTE: inexact
function isSingleColumnTable(table) {
  const rows = table.rows;
  const upperBound = Math.min(rows.length, 20);
  let isSingleColumn = true;
  for(let i = 0; i < upperBound; i++) {
    if(rows[i].cells.length > 1) {
      isSingleColumn = false;
      break;
    }
  }

  return isSingleColumn;
}

// TODO: create and use a TableCellIterator instead of express iteration?
// TODO: test
function transformSingleColumnTable(table) {
  const parent = table.parentElement;
  const nextSibling = table.nextSibling;
  const moveNode = nextSibling ? parent.insertBefore : parent.appendChild;
  const ownerDocument = table.ownerDocument;
  for(let rows = table.rows, numRows = rows.length, rowIndex = 0,
    columnIndex = 0, cell, cells, numCells = 0, firstChild; rowIndex < numRows;
    rowIndex++) {
    for(columnIndex = 0, cells = rows[rowIndex], numCells = cells.length;
      columnIndex < numCells; columnIndex++) {
      for(cell = cells[columnIndex], firstChild = cell.firstChild; firstChild;
        firstChild = cell.firstChild) {
        moveNode(firstChild, nextSibling);
      }
    }

    moveNode(ownerDocument.createElement('p'), nextSibling);
  }

  table.remove();
}

} // END FILE SCOPE
