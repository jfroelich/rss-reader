// Copyright 2015 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

// Represents the results of a document analysis
function CalamineResults() {
  'use strict';

  this.document = null;
  this.bodyElement = null;
  this.textLengths = null;
  this.anchorLengths = null;
  this.textScores = null;
  this.topologyScores = null;
  this.imageParentScores = null;
  this.attributeScores = null;
  this.microdataScores = null;
  this.scores = null;
  this.boilerplateElements = null;
}

// Updates this.scores as the sum of the other scores
// TODO: use destructuring once supported
CalamineResults.prototype.updateElementScores = function() {
  'use strict';

  this.scores = new Map();
  const scores = this.scores;

  for(let e of this.textScores) {
    scores.set(e[0], (scores.get(e[0]) || 0.0) + e[1]);
  }

  for(let e of this.typeScores) {
    scores.set(e[0], (scores.get(e[0]) || 0.0) + e[1]);
  }

  for(let e of this.topologyScores) {
    scores.set(e[0], (scores.get(e[0]) || 0.0) + e[1]);
  }

  for(let e of this.imageParentScores) {
    scores.set(e[0], (scores.get(e[0]) || 0.0) + e[1]);
  }

  for(let e of this.attributeScores) {
    scores.set(e[0], (scores.get(e[0]) || 0.0) + e[1]);
  }
};

// Adds annotations to elements in the document
CalamineResults.prototype.annotate = function() {
  'use strict';

  // Exit early if no analysis performed
  if(!this.bodyElement) {
    return;
  }

  for(let entry of this.textScores) {
    entry[0].dataset.textBias = entry[1].toFixed(2);
  }

  for(let entry of this.typeScores) {
    entry[0].dataset.intrinsicBias = entry[1];
  }

  for(let entry of this.topologyScores) {
    entry[0].dataset.topologyScore = entry[1];
  }

  for(let entry of this.imageParentScores) {
    entry[0].dataset.imageScore = entry[1].toFixed(2);
  }

  for(let entry of this.attributeScores) {
    entry[0].dataset.attributeScore = entry[1].toFixed(2);
  }

  for(let entry of this.scores) {
    entry[0].dataset.score = entry[1].toFixed(2);
  }
};

// TODO: research using Node.compareDocumentPosition instead of contains
CalamineResults.prototype.isContentElement = function(element) {
  'use strict';

  const body = this.bodyElement;

  // If the bodyElement was not set, this always returns true because
  // no analysis was performed. This check would be unnecessary when
  // only calling prune, but this can be called directly
  if(!body) {
    return true;
  }

  return element === body || element.contains(body) ||
    (body.contains(element) && !this.boilerplateElements.has(element));
}

// Removes boilerplate from the internal document
CalamineResults.prototype.prune = function() {
  'use strict';

  // If bodyElement was never set, the document was not analyzed,
  // so exit early and do no pruning
  if(!this.bodyElement) {
    return;
  }

  const garbage = this.document.implementation.createHTMLDocument();
  const elements = this.document.querySelectorAll('*');
  const length = elements.length;
  for(let i = 0, element; i < length; i++) {
    element = elements[i];

    // Check that the element is still located within the current document.
    // A previous iteration of this loop may have indirectly moved the element
    // to a different document by moving an ancestor, because we generally
    // are visiting nodes in top down order (using the in-document-order nature
    // of querySelectorAll).
    if(element.ownerDocument === this.document) {
      // If the element is still a part of the document, check whether the
      // element is content or boilerplate. If it is not content, then
      // remove the element from the document (by moving it).
      if(!this.isContentElement(element)) {
        garbage.adoptNode(element);
      }
    }
  }
};
