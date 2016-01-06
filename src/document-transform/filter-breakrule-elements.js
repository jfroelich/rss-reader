// Copyright 2015 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

// Replaces <br> elements within a document with <p>
// TODO: this function needs some substantial improvement. there are several
// problems with its current approach, such as what happens when inserting
// a paragraph element within an inline element.
// error case: http://paulgraham.com/procrastination.html
function filterBreakruleElements(document) {
  'use strict';

  const elements = document.querySelectorAll('br');
  const length = elements.length;
  for(let i = 0; i < length; i++) {
    const element = elements[i];
    const parent = element.parentElement;
    const p = document.createElement('p');
    parent.replaceChild(p, element);
  }
}
