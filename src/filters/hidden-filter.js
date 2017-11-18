// Module for filtering hidden elements from a document

// TODO: make a github issue about optimizing recursive unwrap

import assert from "/src/assert.js";
import {unwrap} from "/src/dom.js";
import {isHiddenInlineElement} from "/src/visibility.js";

export default function hiddenFilter(doc) {
  assert(doc instanceof Document)
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
