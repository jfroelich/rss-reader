'use strict';

// import dom/visibility.js
// import filters/filter-helpers.js

// TODO: make a github issue about optimizing recursive unwrap
function hidden_filter(doc) {
  console.assert(doc instanceof Document)
  const body = doc.body;

  // Restrict analysis to body descendants
  if(!body) {
    return;
  }

  // contains is called to avoid removing descendants of elements detached in
  // prior iterations.
  // querySelectorAll is used over getElementsByTagName to simplify removal
  // during iteration.

  const elements = body.querySelectorAll('*');
  for(const element of elements) {
    if(body.contains(element) && visibility_element_is_hidden_inline(element)) {
      unwrap_element(element);
    }
  }
}
