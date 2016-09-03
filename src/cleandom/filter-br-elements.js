// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

function filter_br_elements(document) {
  const elements = document.querySelectorAll('br + br');
  for(let i = 0, len = elements.length; i < len; i++) {
    elements[i].remove();
  }
}
