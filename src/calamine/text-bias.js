// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

// Returns a measure indicating whether the element contains boilerplate or
// content based on its text. Elements with a large amount of text are
// generally more likely to be content. Elements with a small amount of text
// contained within anchors are more likely to be content.

// The metric is adapted from the paper:
// "Boilerplate Detection using Shallow Text Features".
// See http://www.l3s.de/~kohlschuetter/boilerplate.
function calamine_derive_text_bias(element) {
  const text = element.textContent;
  const trimmedText = text.trim();
  const textLength = 0.0 + trimmedText.length;
  const anchorLength = 0.0 + calamine_derive_anchor_length(element);
  return (0.25 * textLength) - (0.7 * anchorLength);
}

// Returns the approximate number of characters contained within anchors that
// are descendants of the element.
// This assumes that the HTML is generally well-formed. Specifically it assumes
// no anchor nesting.
// TODO: maybe just inline this in the caller.
function calamine_derive_anchor_length(element) {
  const anchors = element.querySelectorAll('a[href]');
  const numAnchors = anchors.length;
  let anchorLength = 0;
  for(let i = 0, anchor, content; i < numAnchors; i++) {
    anchor = anchors[i];
    content = anchor.textContent.trim();
    anchorLength = anchorLength + content.length;
  }

  return anchorLength;
}
