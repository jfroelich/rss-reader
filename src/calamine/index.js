// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

// Rudimentary lib for filtering boilerplate content from a document
// Requires: /src/calamine/find-signature.js
// Requires: /src/calamine/find-high-score.js
// Requires: /src/calamine/prune.js

// TODO: re-introduce support for annotation
// TODO: think about how to make this pure. Maybe returning a new document
// is nicer. However, it doesn't seem very performant.
// TODO: deal with titles remaining in content
// TODO: i am using scores for finding the body for now, but maybe i want to
// express the weights as probabilities instead of magnitudes
// express everything as probability? Use a scale of 0 to 100
// to represent each element's likelihood of being useful content, where
// 100 is most likely. Every block gets its own probability score. Then
// iteratively back from from a threshold of something like 50%. Or instead
// of blocks weight the elements and use the best element approach again,
// where probability means the likelihood of any given element being the
// best element, not whether it is content or boilerplate.

// Looks for the element that is most likely the root element of the content
// and removes elements all other elements.
function calamine_remove_boilerplate(document) {
  'use strict';

  let bestElement = calamine_find_signature(document);

  if(!bestElement) {
    bestElement = calamine_find_highest_scoring_element(document);
  }

  if(bestElement !== document.documentElement) {
    calamine_prune(document, bestElement);
  }
}
