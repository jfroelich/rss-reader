import assert from '/src/common/assert.js';
import {unwrapElement} from '/src/common/dom-utils.js';

// TODO: move to basic filters

// Filters or transforms certain form elements and form-related elements from
// document content

export default function formFilter(doc) {
  assert(doc instanceof Document);
  if (!doc.body) {
    return;
  }

  const ancestor = doc.body;

  // Unwrap forms
  const forms = ancestor.querySelectorAll('form');
  for (const form of forms) {
    unwrapElement(form);
  }

  // Unwrap labels
  const labels = ancestor.querySelectorAll('label');
  for (const label of labels) {
    unwrapElement(label);
  }

  // TODO: add contains check to reduce operations like removing option nested
  // in select removed in prior iteration

  // Remove form fields
  const inputSelector =
      'button, fieldset, input, optgroup, option, select, textarea';
  const inputs = ancestor.querySelectorAll(inputSelector);
  for (const input of inputs) {
    input.remove();
  }
}
