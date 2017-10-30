'use strict';

// import base/status.js
// import filters/filter-helpers.js

function form_filter(doc) {
  console.assert(doc instanceof Document);

  if(!doc.body) {
    return;
  }

  const ancestor_element = doc.body;

  // TODO: use unwrap_elements?

  // Unwrap forms
  const form_elements = ancestor_element.querySelectorAll('form');
  for(const form_element of form_elements) {
    dom_unwrap(form_element);
  }

  // Unwrap labels
  const label_elements = ancestor_element.querySelectorAll('label');
  for(const label_element of label_elements) {
    dom_unwrap(label_element);
  }

  // TODO: add contains check to reduce operations like removing option
  // nested in select removed in prior iteration

  // Remove form fields
  const input_selector =
    'button, fieldset, input, optgroup, option, select, textarea';
  const input_elements = ancestor_element.querySelectorAll(input_selector);
  for(const input_element of input_elements) {
    input_element.remove();
  }

  return STATUS_OK;
}
