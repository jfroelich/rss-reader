
import assert from "/src/assert.js";
import {unwrapElements} from "/src/filters/filter-helpers.js";

export default function filter(doc) {
  assert(doc instanceof Document);

  if(!doc.body) {
    return;
  }

  unwrapElements(doc.body, 'article, aside, footer, header, main, section');
}
