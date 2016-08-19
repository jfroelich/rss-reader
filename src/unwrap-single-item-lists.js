// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

{ // Begin file block scope

const LIST_SELECTOR = 'ul, ol, dl';

// Scans for lists in the document that contain only a single item and then
// replaces a list with the contents of its one item. Whitespace is added to
// avoid normalization of adjacent text nodes.
this.unwrap_single_item_lists = function(document) {
  const lists = document.querySelectorAll(LIST_SELECTOR);
  // Not using for..of to iterate over lists variable due to V8 deopt warning
  for(let i = 0, len = lists.length; i < len; i++) {
    unwrap_single_item_list(document, lists[i]);
  }
}

// TODO: should i restrict test for dd to only in dl? maybe it's not too
// important

// Not using Set due to performance issues. Although maybe it is worth
// experimenting again
const ITEM_NAMES = {'li': 1, 'dt': 1, 'dd': 1};


// TODO: technically lists could have things like <form> and such, maybe
// what I want to do is instead use list.querySelectorAll(items)? But that is
// not restricted to immediate children, which specifically means it would be
// wrong when the list contains other lists. So I would have to do an explicit
// walk somehow of all descendants not in other list items. Right now I am just
// going to leave this as an unsupported case. I suppose what I could do is look
// into how the browser identifies child items of a list.
function unwrap_single_item_list(document, list) {

  // Scan to and get the first child element
  const item = list.firstElementChild;

  // Ignore lists without items.
  // TODO: i suppose I could eventually remove such lists but that is not
  // currently this function's responsibility
  if(!item) {
    return;
  }

  // If the first child element has a sibling, then this cannot be a single item
  // list
  // TODO: maybe I could use nextSibling here? it would cover the pathological
  // case of <ul><li></li>outofplace</ul>. But it's not that simple, because
  // whitespace text nodes are not out of place.
  if(item.nextElementSibling) {
    return;
  }

  // If the first child element isn't an item, then ignore the list
  if(!(item.localName in ITEM_NAMES)) {
    return;
  }

  // If the item is empty, then we are just going to remove the list.
  // If the list splits text nodes, then replace the list with a space.
  if(!item.firstChild) {
    if(is_text(list.previousSibling) && is_text(list.nextSibling)) {
      list.parentNode.replaceChild(document.createTextNode(' '), list);
    } else {
      list.remove();
    }

    return;
  }

  // If the node preceding the list is a text node, and the first child of the
  // item is a text node, then insert a space preceding the list.
  if(is_text(list.previousSibling) && is_text(item.firstChild)) {
    list.parentNode.insertBefore(document.createTextNode(' '), list);
  }

  // Move the item's child nodes to before the list node
  // TODO: maybe this operation is so simple I don't need to have the
  // dependency here?
  insert_children_before(item, list);

  // If the node following the list is a text node, and the last child of
  // the item was a text node, then insert a space. At this point the list's
  // previous sibling is what was formerly the last child of the item.
  if(is_text(list.nextSibling) &&  is_text(list.previousSibling)) {
    list.parentNode.insertBefore(document.createTextNode(' '), list);
  }

  // The item has been emptied, so remove the entire list (which includes the
  // item)
  list.remove();
}

function is_text(node) {
  return node && node.nodeType === Node.TEXT_NODE;
}

} // End file block scope
