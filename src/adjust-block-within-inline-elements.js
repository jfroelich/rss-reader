// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

{ // Begin file block scope

// NOTE: incomplete for now, i am hesitant to expand
const BLOCK_ELEMENTS = ['blockquote', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p'];
const BLOCK_SELECTOR = BLOCK_ELEMENTS.join(',');

// The closest function expects lowercase selector element names and does
// not totally mirror the behavior of querySelector, I am not sure why.
const INLINE_ELEMENTS = ['a'];
const INLINE_SELECTOR = INLINE_ELEMENTS.join(',');

// Looks for cases such as <a><p>text</p></a> and transforms them into
// <p><a>text</a></p>.
this.adjust_block_inline_elements = function(document) {
  const blocks = document.querySelectorAll(BLOCK_SELECTOR);

  // Not using for..of due to V8 deopt warning about try/catch

  for(let i = 0, len = blocks.length; i < len; i++) {
    let block = blocks[i];
    let ancestor = block.closest(INLINE_SELECTOR);
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
};

} // End file block scope
