import assert from "/src/common/assert.js";

// Filters certain whitespace from a document. This scans the text nodes of a document and
// modifies certain text nodes.

export default function nodeWhitespaceFilter(doc) {
  assert(doc instanceof Document);
  if(!doc.body) {
    return;
  }

  // Ignore node values shorter than this length
  const minNodeValueLength = 3;

  const it = doc.createNodeIterator(doc.body, NodeFilter.SHOW_TEXT);
  for(let node = it.nextNode(); node; node = it.nextNode()) {
    const value = node.nodeValue;
    if(value.length > minNodeValueLength && !isSensitive(node)) {
      const newValue = condenseWhitespace(value);

      if(newValue.length !== value.length) {
        node.nodeValue = newValue;
      }
    }
  }
}

function isSensitive(textNode) {
  return textNode.parentNode.closest('code, pre, ruby, script, style, textarea, xmp');
}

function condenseWhitespace(string) {
  return string.replace(/\s{2,}/g, ' ');
}
