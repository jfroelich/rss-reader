import {unwrap_element} from '/src/base/unwrap-element.js';

// Removes or changes form-related elements from the document
export function form_filter(document) {
  // Note I am not certain whether document.body is cached. I assume it is, but
  // I later do a potentially large amount of removals and have some paranoia.
  // For now, given the separate benefit of using a shorter alias, I cache it
  // in a local variable.
  const body = document.body;

  // This analysis is restricted to the content area of the document. If there
  // is no content area as designated by body then there is nothing to do.
  if (!body) {
    return;
  }

  // The form element itself often contains a substantial amount of actual
  // real content, so removing it would be data loss. So unwrap instead.
  const forms = body.querySelectorAll('form');
  for (const form of forms) {
    unwrap_element(form);
  }

  // It isn't really clear to me whether labels should stay or go, but for now,
  // error on the safe side and unwrap instead of remove.
  // TODO: eventually revisit. It may be stupid to leave labels visible when the
  // thing they correspond to no longer exists.
  const labels = body.querySelectorAll('label');
  for (const label of labels) {
    unwrap_element(label);
  }

  // TODO: I should also consider removing label-like elements that an author
  // did not use a label for. I think there are several instances of where an
  // author does something like use a span, or a neighboring table cell. This
  // might be too difficult to pull off, or require so much processing that it
  // is not worth it.

  // While the selector string is invariant to function calls I prefer to define
  // it here, near where it is used, instead of defining it at module scope.
  // This is similar to the style of declaring variables within loop bodies. I
  // assume that if it is a performance issue the js engine is smart enough to
  // hoist.

  const selector =
      'button, fieldset, input, optgroup, option, select, textarea';
  const form_related_elements = body.querySelectorAll(selector);


  // The contains check avoids removing already-removed elements. It is worth
  // the cost to avoid the more expensive removal operations.


  for (const element of form_related_elements) {
    if (body.contains(element)) {
      element.remove();
    }
  }
}
