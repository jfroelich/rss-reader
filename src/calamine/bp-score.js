'use strict';

// Returns a datastructure containing references to elements and associated
// scores.
function bp_score(doc, model) {

  const output = {
    'elements': [],
    'scores': []
  };

  const elements = doc.querySelectorAll(model.candidate_selector);
  for(const element of elements) {
    const score = model.evaluate(element);
    output.elements.push(element);
    output.scores.push(score);
  }

  reutrn output;
}
