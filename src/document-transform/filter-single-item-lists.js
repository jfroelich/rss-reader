// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

// TODO: this contains some experimental code I don't think I ended up
// using, it should be deleted

'use strict';

{ // BEGIN ANONYMOUS NAMESPACE

// TODO: it may be important to consider the unwrap parent. for example,
// what if this is unwrapping the content into another element that
// should not contain it, like as an immediate child of <table> or
// something like that.

// TODO: focusing on orthogonality, or factoring of features, i think
// that unwrapList and unwrapTable should probably all be merged into
// the general unwrap element function, somehow? Or maybe not, look at
// what I did in filter-single-column-tables regarding moveOperation.
// In order to do this for list, i think i want to pass in the LI, and have
// unwrap find the parent. similarly, for table, i want to pass in the
// the cell, and have unwrap find the container table.
// notably this has the side benefit of avoiding some of the work
// i do below, of re-finding the target child in each of the unwrappers

// TODO: i don't like the check for document.body in this call, it smells,
// think about whose responsibility it is, or maybe do not use document.body
// anyhwere (use querySelectorAll on document)

function filterSingleItemLists(document) {

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

this.filterSingleItemLists = filterSingleItemLists;

function getListItems(list) {
  const filter = Array.prototype.filter;
  return filter.call(list.childNodes, isListItem);
}

// Is this a DOM op that belongs in the dom module? same for other
// similar functions here? how do i clearly define where such functions belong?
// maybe the dom module is too general?
function isListItem(node) {
  // TODO: childNodes returns nodes, make sure this is the proper test
  return node.localName === 'li';
}

function countListItems(list) {
  // TODO: this is generating an intermediate array, that just
  // feels wrong, so use an imperative loop instead
  const filter = Array.prototype.filter;
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


} // END ANONYMOUS NAMESPACE
