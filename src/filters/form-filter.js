'use strict';

// import rbl.js
// import filters/filter-helpers.js

function formFilter(doc) {
  assert(doc instanceof Document);

  if(!doc.body) {
    return;
  }

  const ancestor = doc.body;

  // TODO: use unwrapElements?

  // Unwrap forms
  const forms = ancestor.querySelectorAll('form');
  for(const form of forms) {
    domUnwrap(form);
  }

  // Unwrap labels
  const labels = ancestor.querySelectorAll('label');
  for(const label of labels) {
    domUnwrap(label);
  }

  // TODO: add contains check to reduce operations like removing option
  // nested in select removed in prior iteration

  // Remove form fields
  const inputSelector =
    'button, fieldset, input, optgroup, option, select, textarea';
  const inputs = ancestor.querySelectorAll(inputSelector);
  for(const input of inputs) {
    input.remove();
  }
}
