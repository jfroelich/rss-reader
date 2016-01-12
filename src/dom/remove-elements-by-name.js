// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

// Finds all elements with the given tagName and removes them,
// in reverse document order. This will remove elements that do not need to
// be removed because an ancestor of them will be removed in a later iteration,
// but this is not currently avoidable.
// NOTE: this ONLY works in reverse. getElementsByTagName returns a LIVE
// NodeList/HTMLCollection. Removing elements from the list while iterating
// screws up all later index access when iterating forward. To avoid this,
// use a non-live list such as the one returned by querySelectorAll.
// NOTE: this function is not currently in use, but I am leaving it here as a
// reminder.
function removeElementsByName(document, tagName) {
  'use strict';
  const elements = document.getElementsByTagName(tagName);
  for(let i = elements.length - 1; i > -1; i--) {
    elements[i].remove();
  }
}
