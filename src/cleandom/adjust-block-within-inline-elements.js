// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

{ // Begin file block scope

// NOTE: the list of elements is incomplete, but I am hesitant to expand. I
// think it is good enough for now.
const BLOCK_ELEMENTS = ['blockquote', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p'];
const BLOCK_SELECTOR = BLOCK_ELEMENTS.join(',');

// The Element.prototype.closest function expects lowercase element names,
// at least that is why I got when testing. So make sure never to use uppercase
// names here, or do some more testing.
const INLINE_ELEMENTS = ['a'];
const INLINE_SELECTOR = INLINE_ELEMENTS.join(',');

// Looks for cases such as <a><p>text</p></a> and transforms them into
// <p><a>text</a></p>.
// NOTE: this currently does not consider ...<a><a><p></p></a></a>... and
// similar cases. This only looks at the closest inline ancestor. However I
// don't think it is too important to achieve perfect accuracy here. This is
// simply an attempt to reduce some ugliness in the view.
function adjustBlockInlineElements(document) {
  const blocks = document.querySelectorAll(BLOCK_SELECTOR);
  const numBlocks = blocks.length;
  // Not using for..of due to V8 deopt warning about try/catch

  for(let i = 0; i < numBlocks; i++) {
    const block = blocks[i];
    const ancestor = block.closest(INLINE_SELECTOR);
    if(ancestor && ancestor.parentNode) {
      // Move the block to before the ancestor
      ancestor.parentNode.insertBefore(block, ancestor);

      // Move the block's children into the ancestor.
      for(let node = block.firstChild; node; node = block.firstChild) {
        ancestor.appendChild(node);
      }

      // Move the ancestor into the block
      block.appendChild(ancestor);
    }
  }
}

this.adjustBlockInlineElements = adjustBlockInlineElements;

} // End file block scope
