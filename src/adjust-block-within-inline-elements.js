// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

// Looks for cases like <a><p>text</p></a> and transforms them into
// <p><a>text</a></p>.
function adjustBlockWithinInlineElements(document) {

  // NOTE: these lists are incomplete for now, i am hesitant to expand
  const BLOCK_ELEMENTS = ['blockquote', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'p'];
  const BLOCK_SELECTOR = BLOCK_ELEMENTS.join(',');

  // NOTE: Element.prototype.closest expects lowercase selector element names
  const INLINE_ELEMENTS = ['a'];
  const INLINE_SELECTOR = INLINE_ELEMENTS.join(',');

  const blockElements = document.querySelectorAll(BLOCK_SELECTOR);
  for(let i = 0, len = blockElements.length; i < len; i++) {
    let blockElement = blockElements[i];
    let inlineAncestorElement = blockElement.closest(INLINE_SELECTOR);
    if(inlineAncestorElement && inlineAncestorElement.parentNode) {
      // Move the block to before the ancestor
      inlineAncestorElement.parentNode.insertBefore(blockElement,
        inlineAncestorElement);

      // Move the block's children into the ancestor.
      for(let node = blockElement.firstChild; node;
        node = blockElement.firstChild) {
        inlineAncestorElement.appendChild(node);
      }

      // Move the ancestor into the block
      blockElement.appendChild(inlineAncestorElement);
    }
  }
}
