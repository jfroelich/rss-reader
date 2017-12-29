import assert from "/src/common/assert.js";
import parseHTML from "/src/utils/html/parse.js";
import {isUncheckedError} from "/src/utils/error-utils.js";

// Replaces tags in the input string with the replacement. If no replacement, then removes the
// tags.
export default function replaceTags(htmlString, replacement) {
  assert(typeof htmlString === 'string');

  // Fast case for empty strings
  // Because of the above assert this basically only checks 0 length
  if(!htmlString) {
    return htmlString;
  }

  if(replacement) {
    assert(typeof replacement === 'string');
  }

  let doc;

  try {
    doc = parseHTML(htmlString);
  } catch(error) {
    if(isUncheckedError(error)) {
      throw error;
    } else {
      return 'Unsafe HTML redacted';
    }
  }

  if(!replacement) {
    return doc.body.textContent;
  }

  // Shove the text nodes into an array and then join by replacement
  const it = doc.createNodeIterator(doc.body, NodeFilter.SHOW_TEXT);
  const nodeValues = [];
  for(let node = it.nextNode(); node; node = it.nextNode()) {
    nodeValues.push(node.nodeValue);
  }

  return nodeValues.join(replacement);
}
