
import {assert} from "/src/assert.js";
import {unwrapElements} from "/src/filters/filter-helpers.js";

const FORMATTING_FILTER_SELECTOR = [
  'abbr', 'acronym', 'center', 'data', 'details', 'help', 'insert', 'legend', 'mark', 'marquee',
  'meter', 'nobr', 'span', 'big', 'blink', 'font', 'plaintext', 'small', 'tt'
].join(',');

export function formattingFilter(doc) {
  assert(doc instanceof Document);

  if(!doc.body) {
    return;
  }

  unwrapElements(doc.body, FORMATTING_FILTER_SELECTOR);
}
