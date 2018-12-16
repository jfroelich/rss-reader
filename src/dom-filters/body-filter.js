// Ensures that a document has a body element
// TODO: this should not assume the frame filter ran, right now this does not
// create body when encountering frameset which is misleading, filters should
// be designed so as to be maximally independent and not rely on filter call
// order (not assume some other filters ran before)

export function body_filter(document) {
  if (!document.body) {
    const message = 'This document has no content';
    const error_node = document.createTextNode(message);
    const body_element = document.createElement('body');
    body_element.appendChild(error_node);
    document.documentElement.appendChild(body_element);
  }
}
