
import {assert} from "/src/assert.js";
import {renameElements} from "/src/filters/filter-helpers.js";

// Use shorter names for common elements
export function condenseTagnamesFilter(doc, copyAttributes) {
  assert(doc instanceof Document);

  if(!doc.body) {
    return;
  }

  renameElements(doc.body, 'strong', 'b', copyAttributes);
  renameElements(doc.body, 'em', 'i', copyAttributes);
}
