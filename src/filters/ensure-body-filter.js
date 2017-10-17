
'use strict';

// Ensure the document has a body element
function ensure_body_filter(doc) {

  ASSERT(doc);

  // If body is present then noop
  if(doc.body) {
    return;
  }

  const error_message = 'Error empty document (no body found)';
  const error_text_node = doc.createTextNode(error_message);

  const body_element = doc.createElement('body');
  body_element.appendChild(error_text_node);

  doc.documentElement.appendChild(body_element);
}
