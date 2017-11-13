
import {unwrapElements} from "/src/filters/filter-helpers.js";
import {assert} from "/src/rbl.js";

export function semanticFilter(doc) {
  assert(doc instanceof Document);

  if(!doc.body) {
    return;
  }

  unwrapElements(doc.body, 'article, aside, footer, header, main, section');
}
