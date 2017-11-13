
import {domIsHiddenInline, domUnwrap} from "/src/dom.js";
import {assert} from "/src/rbl.js";

// TODO: make a github issue about optimizing recursive unwrap
export function hiddenFilter(doc) {
  assert(doc instanceof Document)
  const body = doc.body;

  if(!body) {
    return;
  }

  // contains is called to avoid removing descendants of elements detached in
  // prior iterations.
  // querySelectorAll is used over getElementsByTagName to simplify removal
  // during iteration.

  const elements = body.querySelectorAll('*');
  for(const element of elements) {
    if(body.contains(element) && domIsHiddenInline(element)) {
      domUnwrap(element);
    }
  }
}
