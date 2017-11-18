
import assert from "/src/assert.js";
import {unwrapElements} from "/src/filters/filter-helpers.js";

export default function containerFilter(doc) {
  assert(doc instanceof Document);

  if(!doc.body) {
    return;
  }

  unwrapElements(doc.body, 'div, ilayer, layer');
}
