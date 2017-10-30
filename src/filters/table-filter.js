'use strict';

// import base/status.js
// import filters/leaf-filter.js
// import filters/filter-helpers.js
// import dom.js

function table_filter(doc, row_scan_limit) {
  console.assert(doc instanceof Document);

  if(!doc.body) {
    return STATUS_OK;
  }

  unwrap_elements(doc.body, 'colgroup, hgroup, multicol, tbody, tfoot, thead');

  const tables = doc.body.querySelectorAll('table');
  for(const table of tables) {
    if(table_filter_is_single_column_table(table, row_scan_limit))
      table_filter_unwrap_single_column_table(table);
  }

  return STATUS_OK;
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
  for(let i = 0, len = cells.length; i < len; i++) {
    if(!leaf_filter_is_leaf(cells[i]) && ++non_empty_cell_count > 1) {
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

  for(let i = 0; i < row_count; i++) {
    const row = rows[i];
    for(let j = 0, clen = row.cells.length; j < clen; j++) {
      const cell = row.cells[j];

      // Move the children of the cell to before the table
      for(let node = cell.firstChild; node; node = cell.firstChild) {
        parent.insertBefore(node, table);
      }
    }

    parent.insertBefore(doc.createElement('p'), table);
  }

  parent.insertBefore(doc.createTextNode(' '), table);
  table.remove();
}
