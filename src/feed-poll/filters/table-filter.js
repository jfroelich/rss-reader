import assert from "/src/common/assert.js";
import {unwrapElement} from "/src/common/dom-utils.js";
import {leafFilterIsLeaf} from "/src/feed-poll/filters/leaf-filter.js";

// Filters certain table elements from document content

export default function filterDocument(doc, scanLimit) {
  assert(doc instanceof Document);
  if(!doc.body) {
    return;
  }

  const elements = doc.body.querySelectorAll(
    'colgroup, hgroup, multicol, tbody, tfoot, thead');
  for(const element of elements) {
    unwrapElement(element);
  }

  const tables = doc.body.querySelectorAll('table');
  for(const table of tables) {
    if(isSingleColumnTable(table, scanLimit)) {
      unwrapTable(table);
    }
  }
}

function isSingleColumnTable(table, scanLimit) {
  const rows = table.rows;
  const safeLimit = Math.min(rows.length, scanLimit);
  for(let i = 0; i < safeLimit; i++) {
    if(!isSingleColumnRow(rows[i])) {
      return false;
    }
  }
  return true;
}

function isSingleColumnRow(row) {
  const cells = row.cells;
  let nonEmptyCellCount = 0;
  for(let i = 0, len = cells.length; i < len; i++) {
    if(!leafFilterIsLeaf(cells[i]) && ++nonEmptyCellCount > 1) {
      return false;
    }
  }

  return true;
}

function unwrapTable(table) {
  const rows = table.rows;
  const rowCount = rows.length;
  const parent = table.parentNode;
  const doc = table.ownerDocument;

  parent.insertBefore(doc.createTextNode(' '), table);

  for(let i = 0; i < rowCount; i++) {
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
