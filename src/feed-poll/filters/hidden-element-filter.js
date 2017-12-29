import assert from "/src/common/assert.js";
import unwrap from "/src/utils/dom/unwrap-element.js";
import {isHiddenInlineElement} from "/src/utils/dom/visibility.js";

// TODO: make a github issue about optimizing recursive unwrap. I previously did several attempts
// at this. Unfortunately much of the code is lost. There may still be something in the filter
// hidden test file. It probably belongs in experimental, the test was created before I decided on
// organizing experimental code in a folder.

// This does not differentiate between content hidden temporarily and content hidden permanently.
// This looks at content presumably at the time of page load. While this has no real knowledge
// of how other modules work it is assumed this is called in a setting where script is disabled
// and css is restricted so there is little possibility of ephemerally hidden content ever becoming
// visible.

// Filters hidden elements from a document
export default function filterDocument(doc) {
  assert(doc instanceof Document);
  const body = doc.body;
  if(!body) {
    return;
  }

  // contains is called to avoid removing descendants of elements detached in prior iterations.
  // querySelectorAll is used over getElementsByTagName to simplify removal during iteration.

  // This works top-down, which is why each visibility check ignores whether ancestors are
  // visible. Once an ancestor is removed, body no longer contains it, so there is no longer a
  // concern of duplicate evaluation.

  const elements = body.querySelectorAll('*');
  for(const element of elements) {
    if(body.contains(element) && isHiddenInlineElement(element)) {
      unwrap(element);
    }
  }
}
