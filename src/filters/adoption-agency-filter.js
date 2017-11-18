
import assert from "/src/assert.js";

// Relocates certain misnested elements
export default function adoptionAgencyFilter(doc) {
  assert(doc instanceof Document);

  if(!doc.body) {
    return;
  }

  // Fix hr in lists. Simple case of invalid parent
  const nestedHRs = doc.body.querySelectorAll('ul > hr, ol > hr, dl > hr');
  for(const hr of nestedHRs) {
    hr.remove();
  }

  // Relocate some basic occurrences of invalid ancestor
  const blockSelector = 'blockquote, h1, h2, h3, h4, h5, h6, p';
  const inlineSelector = 'a, span, b, strong, i';

  const blocks = doc.body.querySelectorAll(blockSelector);
  for(const block of blocks) {
    const ancestor = block.closest(inlineSelector);
    if(ancestor && ancestor.parentNode) {
      ancestor.parentNode.insertBefore(block, ancestor);
      for(let node = block.firstChild; node; node = block.firstChild) {
        ancestor.appendChild(node);
      }
      block.appendChild(ancestor);
    }
  }
}
