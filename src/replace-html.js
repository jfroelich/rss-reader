// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

// Returns a new string where html elements were replaced with the optional
// replacement string. HTML entities remain (except some will be
// replaced, like &#32; with space).
// TODO: incorrect output when input contains '<html><body>...</body></html>'
// TODO: rename this to be clearer as to what is being replaced
function replaceHTML(inputString, replacementString) {
  let outputString = null;

  const doc = document.implementation.createHTMLDocument();
  const bodyElement = doc.body;
  bodyElement.innerHTML = inputString;

  if(replacementString) {
    const it = doc.createNodeIterator(bodyElement, NodeFilter.SHOW_TEXT);
    let node = it.nextNode();
    const nodeValueBuffer = [];
    while(node) {
      nodeValueBuffer.push(node.nodeValue);
      node = it.nextNode();
    }

    outputString = nodeValueBuffer.join(replacementString);
  } else {
    outputString = bodyElement.textContent;
  }

  return outputString;
}
