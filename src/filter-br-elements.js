// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

// What I essentially want to do is remove all BR elements and replace them
// with paragraphs. This turns out to be very tricky because of the need to
// consider a BR element's ancestors and whether those ancestors are inline
// or not inline.

// TODO: improve, this is very buggy
// error case: http://paulgraham.com/procrastination.html
// TODO: I think using substrings and insertAdjacentHTML might actually
// be the simplest solution? Cognitively, at least.
// While the above code is under development, this is a bandaid that reduces
// the amount of BR elements

function filter_br_elements(document) {

  //const nodeList = document.querySelectorAll('BR');
  //for(let i = 0, len = nodeList.length; i < len; i++) {
    //let brElement = nodeList[i];
    //brElement.renameNode('p');
    //parent = brElement.parentNode;
    //p = document.createElement('P');
    //parent.replaceChild(p, brElement);
  //}

  const elements = document.querySelectorAll('br + br');
  for(let i = 0, len = elements.length; i < len; i++) {
    elements[i].remove();
  }
}
