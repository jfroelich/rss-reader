'use strict';

// import base/errors.js
// import dom.js

const FORMATTING_FILTER_SELECTOR = [
  'abbr', 'acronym', 'center', 'data', 'details', 'help', 'insert', 'legend',
  'mark', 'marquee', 'meter', 'nobr', 'span', 'big', 'blink',
  'font', 'plaintext', 'small', 'tt'
].join(',');


function formattingFilter(doc) {
  console.assert(doc instanceof Document);

  if(!doc.body) {
    return RDR_OK;
  }

  unwrapElements(doc.body, FORMATTING_FILTER_SELECTOR);
  return RDR_OK;
}
