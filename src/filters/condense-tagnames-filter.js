// Changes the names of certain elements in document content

import {renameElements} from "/src/dom/utils.js";
import assert from "/src/utils/assert.js";

// Use shorter names for common elements
export default function condenseTagnamesFilter(doc, copyAttributes) {
  assert(doc instanceof Document);
  if(!doc.body) {
    return;
  }

  renameElements(doc.body, 'strong', 'b', copyAttributes);
  renameElements(doc.body, 'em', 'i', copyAttributes);
}
