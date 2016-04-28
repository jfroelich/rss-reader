// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

// Rudimentary lib for filtering boilerplate content from a document. This is
// essentially a document transformation. Given an input document, analyze
// the document's content, and then produce a new document where some of the
// content was filtered.
//
// For performance, this modifies the document in place, although I am
// considering generating a new document instead as a part of an effort to
// produce a pure function without side effects.
//
// The current implementation is pretty simple. The document is viewed as a
// set of data, where nodes represent pieces of content. Each node is given
// a score indicating how likely the node contains content. Then the node
// with the highest score is found, and all non-intersecting nodes are removed.
//
// Requires: /src/calamine/find-signature.js
// Requires: /src/calamine/find-high-score.js
// Requires: /src/calamine/prune.js

// TODO: re-introduce support for annotation
// TODO: deal with titles remaining in content as a special case.
// TODO: instead of an absolute number, consider treating scores as
// probabilities. 0 is the baseline. The score is signed, meaning there could
// be negative probabilities.
// TODO: maybe deprecate the fast method. It has too many edge cases. Instead,
// just heavily bias the signature-matching elements.
// TODO: go back to my original attempt that used blocks intead of trying to
// find the best root and including all its children. I am getting too many
// false positives. While the best root is very accurate, there is a lot of
// junk included along with it.

// Looks for the element that is most likely the root element of the content
// and removes elements all other elements.
function calamine_remove_boilerplate(document) {
  let bestElement = calamine_find_signature(document);

  if(!bestElement) {
    bestElement = calamine_find_highest_scoring_element(document);
  }

  if(bestElement !== document.documentElement) {
    calamine_prune(document, bestElement);
  }
}
