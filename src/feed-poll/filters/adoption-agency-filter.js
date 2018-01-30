import assert from '/src/common/assert.js';
import {unwrapElement} from '/src/common/dom-utils.js';

// Removes, moves, or otherwise changes certain out-of-place elements in
// document content
export default function filterDocument(doc) {
  assert(doc instanceof Document);

  if (!doc.body) {
    return;
  }

  // Fix hr in lists. Simple case of invalid parent
  const nestedHRs = doc.body.querySelectorAll('ul > hr, ol > hr, dl > hr');
  for (const hr of nestedHRs) {
    hr.remove();
  }

  // Disallow nested anchors. If any anchor has an ancestor anchor, then unwrap
  // the descendant anchor and keep the ancestor.
  const descendantAnchorsOfAnchors = doc.body.querySelectorAll('a a');
  for (const descendantAnchor of descendantAnchorsOfAnchors) {
    unwrapElement(descendantAnchor);
  }

  // Remove figcaption elements not tied to an ancestor figure
  const captions = doc.body.querySelectorAll('figcaption');
  for (const caption of captions) {
    if (!caption.closest('figure')) {
      caption.remove();
    }
  }

  // Remove source elements not meaningfully tied to an ancestor
  const sources = doc.body.querySelectorAll('source');
  for (const source of sources) {
    if (!source.closest('audio, picture, video')) {
      source.remove();
    }
  }

  // Relocate some basic occurrences of invalid ancestor
  const blockSelector = 'blockquote, h1, h2, h3, h4, h5, h6, p';
  const inlineSelector = 'a, span, b, strong, i';

  const blocks = doc.body.querySelectorAll(blockSelector);
  for (const block of blocks) {
    const ancestor = block.closest(inlineSelector);
    if (ancestor && ancestor.parentNode) {
      ancestor.parentNode.insertBefore(block, ancestor);
      for (let node = block.firstChild; node; node = block.firstChild) {
        ancestor.appendChild(node);
      }
      block.appendChild(ancestor);
    }
  }
}
