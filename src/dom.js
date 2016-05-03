// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

// DOM utilities

// Returns the value of a dom text node
function dom_get_node_value(textNode) {
  return textNode.nodeValue;
}

function dom_hide_element(element) {
  element.style.display = 'none';
}

function dom_show_element(element) {
  element.style.display = 'block';
}

function dom_add_class(element, classNameString) {
  element.classList.add(classNameString);
}

function dom_remove_class(element, classNameString) {
  element.classList.remove(classNameString);
}

function dom_is_element_visible(element) {
  return element.style.display === 'block';
}
