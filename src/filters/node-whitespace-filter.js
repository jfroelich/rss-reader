import assert from "/src/utils/assert.js";
import {condenseWhitespace} from "/src/utils/string-utils.js";

export default function nodeWhitespaceFilter(doc) {
  assert(doc instanceof Document);
  if(!doc.body) {
    return;
  }

  // Ignore node values less than this (exclusive)
  const minNodeValueLength = 3;

  const it = doc.createNodeIterator(doc.body, NodeFilter.SHOW_TEXT);
  for(let node = it.nextNode(); node; node = it.nextNode()) {
    const value = node.nodeValue;
    if(value.length > minNodeValueLength && !isSensitive(node)) {
      const newValue = condenseWhitespace(value);

      // Only set if value length changed
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
