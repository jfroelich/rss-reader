// Copyright 2015 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

const ListTransform = {};

{ // BEGIN ANONYMOUS NAMESPACE


ListTransform.transform = function(document, rest) {

  // TODO: because we are removing lists, this should be 
  // using NodeIterator or querySelectorAll

  // Replace lists with one item with the item's content
  // For now this just focuses on unordered lists
  const lists = document.getElementsByTagName('ul');
  const numLists = lists.length;
  for(let i = 0; i < numLists; i++) {
  	const list = lists[i];
  	
  	// because we are using gebtn and mutating during iteration,
  	// check if element at index is still defined
  	if(!list) {
  	  continue;
  	}

  	const itemCount = getListItemCount(list);
  	if(itemCount === 1) {
  	  unwrapList(list);
  	}
  }
};

function getListItemCount(list) {
  const reduce = Array.prototype.reduce;
  return reduce.call(list.childNodes, function(count, node) {
    return count + (node.localName === 'li' ? 1 : 0);
  }, 0);
}

function unwrapList(list) {
  //console.debug('Unwrapping list %s', list.parentElement.innerHTML);
  const parent = list.parentElement;
  const item = list.querySelector('li');
  const nextSibling = list.nextSibling;

  if(nextSibling) {
    // Move the item's children to before the list's 
    // next sibling
    while(item.firstChild) {
      parent.insertBefore(item.firstChild, nextSibling);
    }
  } else {
    // The list is the last node in its container, so append
    // the item's children to the container
    while(item.firstChild) {
      parent.appendChild(item.firstChild);
    }
  }

  list.remove();
}

} // END ANONYMOUS NAMESPACE
