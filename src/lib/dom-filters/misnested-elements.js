import unwrapElement from '/src/lib/unwrap-element.js';

// Searches the document for misnested elements and tries to fix each occurrence.
export default function removeMisnestedElements(document) {
  // Remove horizontal rules embedded within lists
  const hrsWithinLists = document.querySelectorAll('ul > hr, ol > hr, dl > hr');
  for (const hr of hrsWithinLists) {
    hr.remove();
  }

  // Remove invalid double anchors
  const nestedAnchors = document.querySelectorAll('a a');
  for (const descendantAnchor of nestedAnchors) {
    unwrapElement(descendantAnchor);
  }

  // Remove all captions outside of figure
  const captions = document.querySelectorAll('figcaption');
  for (const caption of captions) {
    if (!caption.parentNode.closest('figure')) {
      caption.remove();
    }
  }

  // Remove all source elements not located within an expected ancestor.
  const sources = document.querySelectorAll('source');
  for (const source of sources) {
    if (!source.parentNode.closest('audio, picture, video')) {
      source.remove();
    }
  }

  // display-block within display-block-inline
  const blockSelector = 'blockquote, h1, h2, h3, h4, h5, h6, p';
  const inlineSelector = 'a, span, b, strong, i';

  const blocks = document.querySelectorAll(blockSelector);
  for (const block of blocks) {
    const ancestor = block.closest(inlineSelector);
    if (ancestor && ancestor.parentNode) {
      ancestor.parentNode.insertBefore(block, ancestor);
      for (let node = block.firstChild; node; node = block.firstChild) {
        ancestor.append(node);
      }
      block.append(ancestor);
    }
  }
}
