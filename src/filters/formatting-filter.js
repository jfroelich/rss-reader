import unwrapElements from "/src/dom/unwrap-elements.js";
import assert from "/src/assert/assert.js";

const SELECTOR = [
  'abbr', 'acronym', 'center', 'data', 'details', 'help', 'insert', 'legend', 'mark', 'marquee',
  'meter', 'nobr', 'span', 'big', 'blink', 'font', 'plaintext', 'small', 'tt'
].join(',');

// Remove certain formatting elements from document content
export default function filterDocument(document) {
  assert(document instanceof Document);
  if(!document.body) {
    return;
  }

  unwrapElements(document.body, SELECTOR);
}
