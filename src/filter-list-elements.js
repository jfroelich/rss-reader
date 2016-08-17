// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

// Unwrap lists with only one item.
function filter_list_elements(document) {
  const ITEM_NAMES = {'LI': 1, 'DT': 1, 'DD': 1};
  const lists = document.querySelectorAll('UL, OL, DL');
  for(let i = 0, len = lists.length; i < len; i++) {
    let listElement = lists[i];
    if(listElement.childElementCount === 1) {
      let itemElement = listElement.firstElementChild;
      if(itemElement.nodeName in ITEM_NAMES) {
        listElement.parentNode.insertBefore(document.createTextNode(' '),
          listElement);
        insert_children_before(itemElement, listElement);
        listElement.parentNode.insertBefore(document.createTextNode(' '),
          listElement);
        listElement.remove();
      }
    }
  }
}
