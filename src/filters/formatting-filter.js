// Remove certain formatting elements from document content

import assert from "/src/utils/assert.js";
import {unwrapElements} from "/src/filters/filter-helpers.js";

const SELECTOR = [
  'abbr', 'acronym', 'center', 'data', 'details', 'help', 'insert', 'legend', 'mark', 'marquee',
  'meter', 'nobr', 'span', 'big', 'blink', 'font', 'plaintext', 'small', 'tt'
].join(',');

export default function formattingFilter(doc) {
  assert(doc instanceof Document);

  if(!doc.body) {
    return;
  }

  unwrapElements(doc.body, SELECTOR);
}
