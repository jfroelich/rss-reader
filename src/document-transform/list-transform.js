// Copyright 2015 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

const ListTransform = {};

{ // BEGIN ANONYMOUS NAMESPACE

ListTransform.transform = function ListTransform$Transform(document, rest) {

  const it = document.createNodeIterator(document.documentElement,
    NodeIterator.SHOW_ELEMENT, acceptListSingleton);
  let list = it.nextNode();
  while(list) {
    unwrapList(list);
    list = it.nextNode();
  }
};

function acceptListSingleton(node) {
  if(node.localName !== 'ul')
    return NodeFilter.FILTER_REJECT;

  let count = 0;
  let numChildren = node.childNodes.length;
  for(let i = 0; i < numChildren; i++) {
    if(node.childNodes[i].localName === 'li') {
      count++;
    }
  }

  if(count === 1) {
    return NodeFilter.FILTER_ACCEPT;
  }

  return NodeFilter.FILTER_REJECT;

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
