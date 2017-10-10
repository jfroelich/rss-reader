'use strict';

function bp_prune_to_best(doc, score_result) {

  const body_element = doc.body;
  if(!body_element)
    return;

  const best_element = bp_find_best_element(score_result);
  if(!best_element)
    return;

  bp_prune_internal(doc, best_element);
}

function bp_find_best_element(score_result) {
  let high_score = 0;
  let best_element;
  let high_score_index = -1;
  let index = 0;
  for(const score of score_result.scores) {
    if(score > high_score) {
      high_score = score;
      high_score_index = index;
    }
    index++;
  }

  if(high_score_index !== -1)
    best_element = score_result.elements[high_score_index];
  return best_element;
}


// Detach elements that do not intersect with the best element
function bp_prune_internal(doc, best_element) {
  if(best_element === doc.documentElement)
    return;
  if(best_element === doc.body)
    return;

  // This should always be true. If the caller managed to call this function
  // with out this being true that is a clear violation of an invariant
  // requirement.
  ASSERT(doc.documentElement.contains(best_element));

  const elements = doc.body.querySelectorAll('*');
  for(let element of elements) {
    // Keep ancestors of best element
    if(element.contains(best_element))
      continue;
    // Keep descendants of best element
    if(best_element.contains(element))
      continue;
    // Ignore children of removed elements
    if(!doc.documentElement.contains(element))
      continue;
    element.remove();
  }
}
