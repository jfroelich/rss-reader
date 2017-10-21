'use strict';

// import base/assert.js
// import base/status.js

// Relocates certain misnested elements
function adoption_agency_filter(doc) {
  ASSERT(doc instanceof Document);

  // Restrict analysis to body
  if(!doc.body) {
    return STATUS_OK;
  }

  // Fix hr in lists. Simple case of invalid parent
  const nestedhrs = doc.body.querySelectorAll('ul > hr, ol > hr, dl > hr');
  for(const hr of nestedhrs) {
    hr.remove();
  }

  // Relocate some basic occurrences of invalid ancestor
  const block_selector = 'blockquote, h1, h2, h3, h4, h5, h6, p';
  const inline_selector = 'a, span, b, strong, i';

  const blocks = doc.body.querySelectorAll(block_selector);
  for(const block of blocks) {
    const ancestor = block.closest(inline_selector);
    if(ancestor && ancestor.parentNode) {
      ancestor.parentNode.insertBefore(block, ancestor);
      for(let node = block.firstChild; node; node = block.firstChild) {
        ancestor.appendChild(node);
      }
      block.appendChild(ancestor);
    }
  }

  return STATUS_OK;
}
