import assert from "/src/assert/assert.js";
import unwrapElement from "/src/dom/unwrap-element.js";

const SELECTOR = [
  'abbr', 'acronym', 'center', 'data', 'details', 'help', 'insert', 'legend', 'mark', 'marquee',
  'meter', 'nobr', 'span', 'big', 'blink', 'font', 'plaintext', 'small', 'tt'
].join(',');

// Remove formatting elements
export default function filterDocument(document) {
  assert(document instanceof Document);
  if(document.body) {
    const elements = document.body.querySelectorAll(SELECTOR);
    for(const element of elements) {
      unwrapElement(element);
    }
  }
}
