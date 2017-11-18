
import assert from "/src/assert.js";
import {condenseWhitespace} from "/src/string.js";

export default function nodeWhitespaceFilter(doc) {
  assert(doc instanceof Document);

  if(!doc.body) {
    return;
  }

  const it = doc.createNodeIterator(doc.body, NodeFilter.SHOW_TEXT);
  for(let node = it.nextNode(); node; node = it.nextNode()) {
    const value = node.nodeValue;
    if(value.length > 3 && !isSensitive(node)) {
      const newValue = condenseWhitespace(value);
      if(newValue.length !== value.length) {
        node.nodeValue = newValue;
      }
    }
  }
}

function isSensitive(node) {
  const selector = 'code, pre, ruby, script, style, textarea, xmp';
  return node.parentNode.closest(selector);
}
