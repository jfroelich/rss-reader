import unwrap from "/src/utils/dom/unwrap-element.js";
import {isHiddenInlineElement} from "/src/utils/dom/visibility.js";
import assert from "/src/utils/assert.js";

// TODO: make a github issue about optimizing recursive unwrap

// Module for filtering hidden elements from a document

export default function filter(doc) {
  assert(doc instanceof Document);
  const body = doc.body;
  if(!body) {
    return;
  }

  // contains is called to avoid removing descendants of elements detached in prior iterations.
  // querySelectorAll is used over getElementsByTagName to simplify removal during iteration.

  const elements = body.querySelectorAll('*');
  for(const element of elements) {
    if(body.contains(element) && isHiddenInlineElement(element)) {
      unwrap(element);
    }
  }
}
