
import assert from "/src/assert.js";
import {unwrap} from "/src/dom.js";

export function formFilter(doc) {
  assert(doc instanceof Document);
  if(!doc.body) {
    return;
  }

  const ancestor = doc.body;

  // TODO: use unwrapElements?

  // Unwrap forms
  const forms = ancestor.querySelectorAll('form');
  for(const form of forms) {
    unwrap(form);
  }

  // Unwrap labels
  const labels = ancestor.querySelectorAll('label');
  for(const label of labels) {
    unwrap(label);
  }

  // TODO: add contains check to reduce operations like removing option nested in select removed in
  // prior iteration

  // Remove form fields
  const inputSelector = 'button, fieldset, input, optgroup, option, select, textarea';
  const inputs = ancestor.querySelectorAll(inputSelector);
  for(const input of inputs) {
    input.remove();
  }
}
