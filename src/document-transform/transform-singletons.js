// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

// TODO: transforming lists and tables are two separate functions that have
// relatively little to do with each other. While they each perform a similar
// type of function, they are not actually related. Therefore, this file
// should be split into two files.

// TODO: the table transform should also consider a single-column table
// as transformable, not just a single-celled table. In the case of a single
// column table, just insert paragraph elements between cells.

'use strict';

{ // BEGIN ANONYMOUS NAMESPACE

const filter = Array.prototype.filter;

// TODO: it may be important to consider the unwrap parent. for example,
// what if this is unwrapping the content into another element that
// should not contain it, like as an immediate child of <table> or
// something like that.

// TODO: focusing on orthogonality, or factoring of features, i think
// that unwrapList and unwrapTable should probably all be merged into
// the general unwrap element function, somehow.
// to do this for list, i think i want to pass in the LI, and have
// unwrap find the parent. similarly, for table, i want to pass in the
// the cell, and have unwrap find the container table.
// notably this has the side benefit of avoiding some of the work
// i do below, of re-finding the target child in each of the unwrappers

// TODO: i don't like the check for document.body in this call, it smells,
// think about whose responsibility it is


function unwrapSingletonLists(document) {

  if(!document.body) {
    return;
  }

  const elements = document.body.querySelectorAll('ul');
  let children = null;
  for(let i = 0, len = elements.length, list; i < len; i++) {
    list = elements[i];
    //children = getListItems(list);
    //if(children.length === 1) {
    //  unwrapListItem(children[0]);
    //}

    if(countListItems(list) === 1) {
      unwrapSingleItemList(list);
    }
  }
}

this.unwrapSingletonLists = unwrapSingletonLists;

function getListItems(list) {
  return filter.call(list.childNodes, isListItem);
}


function isListItem(node) {
  // TODO: childNodes returns nodes, make sure this is the proper test
  return node.localName === 'li';
}

function countListItems(list) {
  // TODO: this is generating an intermediate array, that just
  // feels wrong, so use an imperative loop instead
  return filter.call(list.childNodes, isListItem).length;
}

function getFirstListItem(list) {
  for(let i = 0, nodes = list.childNodes, len = nodes.length, node;
    i < len; i++) {
    node = nodes[i];
    if(isListItem(node)) {
      return node;
    }
  }
}

// Finds the parent of an <LI>. Returns undefined if not found.
function getListItemListParent(listItem) {
  let parent = listItem.parentElement;
  while(parent) {
    if(parent.localName === 'ul' || parent.localName === 'ol') {
      return parent;
    }

    parent = parent.parentElement;
  }
}

// TODO: actually, the problem is that we are unwrapping the
// list, not just the list item. this is now semantically misleading.
function unwrapListItem(listItem) {
  const list = getListItemListParent(listItem);


  let parent = null, nextSibling = null;

  if(list) {
    parent = list.parentElement;
    nextSibling = list.nextSibling;
  } else {
    parent = listItem.parentElement;
    // ??? TODO what do we point too?
    nextSibling = null;
  }

  // TODO: now unwrap

  // don't forget to remove the list and list item
}


// assumes the list item count > 0
function unwrapSingleItemList(list) {
  const parent = list.parentElement;
  const item = getFirstListItem(list);
  const nextSibling = list.nextSibling;
  if(nextSibling) {
    while(item.firstChild) {
      parent.insertBefore(item.firstChild, nextSibling);
    }
  } else {
    while(item.firstChild) {
      parent.appendChild(item.firstChild);
    }
  }

  list.remove();
}

function unwrapSingletonTables(document) {
  if(!document.body) {
    return;
  }
  const tables = document.body.querySelectorAll('table');
  for(let i = 0, len = tables.length, table, cell; i < len; i++) {
    table = tables[i];
    cell = getTableSingleCell(table);
    if(cell) {
      unwrapSingletonTable(table, cell);
    }
  }
}

this.unwrapSingletonTables = unwrapSingletonTables;

function getTableSingleCell(table) {
  const numRows = table.rows.length;
  if(numRows === 1) {
    const numCells = table.rows[0].cells.length;
    if(numCells === 1) {
      return table.rows[0].cells[0];
    }
  }
}

function unwrapSingletonTable(table, cell) {
  const parent = table.parentElement;
  const nextSibling = table.nextSibling;
  if(nextSibling) {
    while(cell.firstChild) {
      parent.insertBefore(cell.firstChild, nextSibling);
    }
  } else {
    while(cell.firstChild) {
      parent.appendChild(cell.firstChild);
    }
  }

  table.remove();
}

} // END ANONYMOUS NAMESPACE
