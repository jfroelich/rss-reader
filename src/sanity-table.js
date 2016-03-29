// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

// Requires: /src/sanity-unwrap.js

// Unwraps single column and single cell tables
function sanity_filter_tables(document) {
  'use strict';

  const tables = document.querySelectorAll('TABLE');
  const tableLength = tables.length;

  let rows = null;
  let cells = null;
  let cell = null;
  let table = null;
  let rowLength = 0;

  for(let i = 0; i < tableLength; i++) {
    table = tables[i];
    rows = table.rows;
    rowLength = rows.length;

    if(rowLength === 1) {
      cells = rows[0].cells;
      if(cells.length === 1) {
        sanity_unwrap_single_cell_table(table);
        continue;
      }
    }

    if(sanity_is_single_column_table(table)) {
      sanity_unwrap_single_column_table(table);
    }
  }
}

// TODO: allow for empty rows?
function sanity_unwrap_single_cell_table(table) {
  'use strict';
  const cell = table.rows[0].cells[0];
  const document = table.ownerDocument;
  const tableParent = table.parentNode;
  tableParent.insertBefore(document.createTextNode(' '), table);
  sanity_insert_children_before(cell, table);
  tableParent.insertBefore(document.createTextNode(' '), table);
  table.remove();
}

// Examines the first 50 rows of a table element and decides whether
// the table is probably a simple single column table
function sanity_is_single_column_table(table) {
  'use strict';

  const rows = table.rows;
  const rowLength = rows.length;
  const upperBound = Math.min(rowLength, 50);
  for(let i = 0; i < upperBound; i++) {
    if(rows[i].cells.length > 1) {
      return false;
    }
  }

  return true;
}

function sanity_unwrap_single_column_table(table) {
  'use strict';

  // console.debug('Unwrapping single column table', table);
  const document = table.ownerDocument;
  const tableParent = table.parentNode;
  const rows = table.rows;
  const rowLength = rows.length;

  tableParent.insertBefore(document.createTextNode(' '), table);
  for(let rowIndex = 0, colIndex = 0, cells; rowIndex < rowLength;
    rowIndex++) {
    cells = rows[rowIndex];
    for(colIndex = 0; colIndex < cells.length; colIndex++) {
      sanity_insert_children_before(cells[colIndex], table);
    }
    tableParent.insertBefore(document.createElement('P'), table);
  }
  tableParent.insertBefore(document.createTextNode(' '), table);
  table.remove();
}
