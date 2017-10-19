'use strict';

// Dependencies:
// ??


function form_filter(doc) {
  if(!doc.body)
    return;
  const ancestor_element = doc.body;

  // Unwrap forms
  const form_elements = ancestor_element.querySelectorAll('form');
  for(const form_element of form_elements)
    unwrap_element(form_element);

  // Unwrap labels
  const label_elements = ancestor_element.querySelectorAll('label');
  for(const label_element of label_elements)
    unwrap_element(label_element);

  // Remove form fields
  const input_selector =
    'button, fieldset, input, optgroup, option, select, textarea';
  const input_elements = ancestor_element.querySelectorAll(input_selector);
  for(const input_element of input_elements)
    input_element.remove();
}
