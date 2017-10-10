'use strict';

function foo(doc) {
  const model_options = {};
  const model = bp_create_model(model_options);
  const score_result = bp_score(doc, model);
  bp_prune_to_best(doc, score_result);
}
