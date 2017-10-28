'use strict';

// import base/status.js
// import dom/element.js

const FORMATTING_FILTER_SELECTOR = [
  'abbr', 'acronym', 'center', 'data', 'details', 'help', 'insert', 'legend',
  'mark', 'marquee', 'meter', 'nobr', 'span', 'big', 'blink',
  'font', 'plaintext', 'small', 'tt'
].join(',');


function formatting_filter(doc) {
  console.assert(doc instanceof Document);

  if(!doc.body) {
    return STATUS_OK;
  }

  unwrap_elements(doc.body, FORMATTING_FILTER_SELECTOR);
  return STATUS_OK;
}
