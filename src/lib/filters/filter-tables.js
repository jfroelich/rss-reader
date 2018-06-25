import {unwrap_element} from '/src/lib/dom/unwrap-element.js';
import {is_leaf_node} from '/src/lib/filters/node-is-leaf.js';

// Filters certain table elements from document content
export function filter_tables(document, table_row_scan_max) {
  if (document.body) {
    const elements = document.body.querySelectorAll(
        'colgroup, hgroup, multicol, tbody, tfoot, thead');
    for (const element of elements) {
      unwrap_element(element);
    }

    const tables = document.body.querySelectorAll('table');
    for (const table of tables) {
      if (table_element_is_single_column(table, table_row_scan_max)) {
        table_element_unwrap(table);
      }
    }
  }
}

function table_element_is_single_column(table, table_row_scan_max) {
  const rows = table.rows;
  const safe_limit = Math.min(rows.length, table_row_scan_max);
  for (let i = 0; i < safe_limit; i++) {
    if (!row_is_single_column(rows[i])) {
      return false;
    }
  }
  return true;
}

function row_is_single_column(row) {
  const cells = row.cells;
  let filled_cell_count = 0;

  // TODO: review the logic here. Is pre-decrement op correct?

  for (let i = 0, len = cells.length; i < len; i++) {
    if (!is_leaf_node(cells[i]) && ++filled_cell_count > 1) {
      return false;
    }
  }

  return true;
}

function table_element_unwrap(table) {
  const rows = table.rows;
  const row_count = rows.length;
  const parent = table.parentNode;
  const document = table.ownerDocument;

  parent.insertBefore(document.createTextNode(' '), table);

  for (let i = 0; i < row_count; i++) {
    const row = rows[i];
    for (let j = 0, clen = row.cells.length; j < clen; j++) {
      const cell = row.cells[j];

      // Move the children of the cell to before the table
      for (let node = cell.firstChild; node; node = cell.firstChild) {
        parent.insertBefore(node, table);
      }
    }

    parent.insertBefore(document.createElement('p'), table);
  }

  parent.insertBefore(document.createTextNode(' '), table);
  table.remove();
}
