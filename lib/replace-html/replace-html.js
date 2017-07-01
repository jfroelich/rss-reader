// See license.md

'use strict';

// TODO: switch to parseHTML

// Returns a new string where html elements were replaced with the optional
// replacement string. HTML entities remain (except some will be
// replaced, like &#32; with space).
function replaceHTML(inputString, replacementString) {

  // Parse the input string into an html document so that we can easily
  // walk the elements
  const documentObject = document.implementation.createHTMLDocument();
  const bodyElement = documentObject.body;
  bodyElement.innerHTML = inputString;

  // If there is no replacement string, then default to the browser's built-in
  // tag stripping function, which is simply accessing textContent. The exact
  // behavior may differ from below but it is very fast.
  if(!replacementString) {
    return bodyElement.textContent;
  }

  // Find all text nodes, then join using the replacement as a delimiter,
  // which effectively replaces any elements with the replacement
  const nodeIterator = documentObject.createNodeIterator(bodyElement,
    NodeFilter.SHOW_TEXT);
  const stringsArray = [];
  for(let node = nodeIterator.nextNode(); node;
    node = nodeIterator.nextNode()) {
    stringsArray.push(node.nodeValue);
  }

  return stringsArray.join(replacementString);
}
