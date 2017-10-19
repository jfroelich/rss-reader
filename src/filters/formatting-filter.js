'use strict';

// Dependencies:
// assert.js
// element.js

const FORMATTING_FILTER_SELECTOR = [
  'abbr', 'acronym', 'center', 'data', 'details', 'help', 'insert', 'legend',
  'mark', 'marquee', 'meter', 'nobr', 'span', 'big', 'blink',
  'font', 'plaintext', 'small', 'tt'
].join(',');


function formatting_filter(doc) {
  ASSERT(doc);

  if(!doc.body) {
    return;
  }

  unwrap_elements(doc.body, FORMATTING_FILTER_SELECTOR);
}
