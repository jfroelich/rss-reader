'use strict';

// import rbl.js

function nodeWhitespaceFilter(doc) {
  assert(doc instanceof Document);

  if(!doc.body) {
    return;
  }

  const it = doc.createNodeIterator(doc.body, NodeFilter.SHOW_TEXT);
  for(let node = it.nextNode(); node; node = it.nextNode()) {
    const value = node.nodeValue;
    if(value.length > 3 && !nodeWhitespaceFilterIsSensitive(node)) {
      const newValue = rbl.condenseWhitespace(value);
      if(newValue.length !== value.length) {
        node.nodeValue = newValue;
      }
    }
  }
}

function nodeWhitespaceFilterIsSensitive(node) {
  const selector = 'code, pre, ruby, script, style, textarea, xmp';
  return node.parentNode.closest(selector);
}
