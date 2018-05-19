// TODO: add console parameter

// TODO: reconsider the use of this filter. Maybe none of the filters
// should assume body is present and each should approach the document
// structure more cautiously. This would decrease inter-dependence and
// reliance across filters, which makes it easier to reason about filters,
// write new filters, and care less about filter order. The second reason is
// more that I do not see the point of creating a body if it will not be
// used. Also note that I will have to make the consumers of the document,
// such as the view, more cautious.
// TODO: another issue is that this filter is poorly named. This filter
// currently also has the responsibility of adding the message that displayed
// for empty documents. That should probably be done elsewhere.

export function ensure_document_body(document) {
  if (!document.body) {
    const message = 'This document has no content';
    const error_node = document.createTextNode(message);
    const body_element = document.createElement('body');
    body_element.appendChild(error_node);
    document.documentElement.appendChild(body_element);
  }
}
