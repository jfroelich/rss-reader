// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

// Unwraps tables that generally consist of a single column
function filterTableElements(document, inspectionRowLimit) {
  const tables = document.querySelectorAll('table');
  for(let i = 0, len = tables.length; i < len; i++) {
    const table = tables[i];
    if(isSingleColumnTable(table, inspectionRowLimit)) {
      unwrapSingleColumnTable(table);
    }
  }
}

function isSingleColumnTable(table, inspectionRowLimit) {
  const rows = table.rows;
  const upperBound = Math.min(rows.length, inspectionRowLimit);
  for(let j = 0; j < upperBound; j++) {
    if(!isSingleColumnRowElement(rows[j])) {
      return false;
    }
  }
  return true;
}


// isSingleColumnTable does not guarantee that all rows are single column, so
// we still iterate all cells per row, even though most of the time this
// is just one cell.
// TODO: rather than insert spaces and paragraphs, create paragraphs
// and move cell contents into them, then insert the paragraphs.
// -- check if there is only one child that is a paragraph and if so maybe
// just use that instead of a new paragraph
// note this means i dont think i can use insertChildrenBefore, so i have to
// write the lower level moves, or i have to think of how to reorient
// the helper function so that is more abstract. i think the issue is that
// it isnt as flexible as say insertAdjacentHTML's location parameter. so
// maybe i just need an entirely different function. maybe use the
// moveChildNodes function, but pass in a new parameter that suppresses
// the use of the document fragment and just does the straight appendChild
// call per node. Either that, or I should have two functions,
// moveChildNodesUsingFragment, and moveChildNodes. or maybe i make a
// function accept a parent element, and if i want to use a fragment,
// pass that in
function unwrapSingleColumnTable(table) {
  const rows = table.rows;
  const numRows = rows.length;
  const tableParent = table.parentNode;

  // Pad left to avoid creating adjacent text
  // TODO: would a single call to insertAdjacentHTML be faster here?
  // something like
  // table.insertAdjacentHTML('beforestart', ' ');
  tableParent.insertBefore(document.createTextNode(' '), table);

  for(let j = 0; j < numRows; j++) {
    let row = rows[j];

    // TODO: if the cell is a leaf node, skip it and do not create
    // a new paragraph.
    for(let k = 0, clen = row.cells.length; k < clen; k++) {
      let cell = row.cells[k];
      insertChildrenBefore(cell, table);
    }

    tableParent.insertBefore(document.createElement('p'), table);
  }

  // Pad right to avoid creating adjacent text
  tableParent.insertBefore(document.createTextNode(' '), table);
  table.remove();
}

// A row is a single column when it is either empty or contains no more than
// one non-leaf cell.
// TODO: the logic here could be simplified. Maybe just use a boolean
// instead of a counter.
function isSingleColumnRowElement(rowElement) {
  const cells = rowElement.cells;

  let nonEmptyCount = 0;
  for(let i = 0, len = cells.length; i < len; i++) {
    let cell = cells[i];
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
        // console.debug('Not a single column:', rowElement.outerHTML);
        return false;
      }
    }
  }

  return true;
}
