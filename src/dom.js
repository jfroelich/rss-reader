// Copyright 2014 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

var lucu = lucu || {};

lucu.dom = {};

/**
 * Detatches an element from the dom
 */
lucu.dom.remove = function(element) {
  element.remove();
};

/**
 * Replaces the element with its children
 *
 * NOTE: This is not optimized to be called on a live document. This causes a 
 * reflow per move.
 */
lucu.dom.unwrap = function(element) {

  const parent = element.parentElement;

  // Avoid issues with documentElement or detached elements
  if(!parent) {
    return;
  }

  // Move each child of the element to the position preceding the element in
  // the parent's node list, maintaining child order.
  while(element.firstChild) {
    parent.insertBefore(element.firstChild, element);
  }

  // Now the element is empty so detach it
  element.remove();
};
