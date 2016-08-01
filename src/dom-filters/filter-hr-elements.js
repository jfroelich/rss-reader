// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

function filterHRElements(document) {

  const selector = [
    'hr + hr', // consecutive hrs
    'ul > hr', // hierarchy error
    'ol > hr' // hierarchy error
  ].join(',');

  const elements = document.querySelectorAll(selector);
  for(let i = 0, len = elements.length; i < len; i++) {
    elements[i].remove();
  }
}
