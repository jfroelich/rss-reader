
function transform_framed_document(doc) {
  'use strict';

  let body_element = doc.body;
  if(!body_element)
    return;

  // Remove iframes
  const iframe_elements = doc.querySelectorAll('iframe');
  for(const iframe_element of iframe_elements)
    iframe_element.remove();

  // If document is not framed, then nothing else to do
  if(body_element.localName !== 'frameset')
    return;

  // The document is framed, transform into unframed
  let new_body_element = doc.createElement('body');

  // If available, move noframes content into the new body.
  const noframes_element = doc.querySelector('noframes');
  if(noframes_element) {
    for(let node = noframes_element.firstChild; node;
      node = noframes_element.firstChild)
      new_body_element.appendChild(node);
  }

  // If the new body is empty, add an error message about framed content
  if(!new_body_element.firstChild) {
    const error_text_node = doc.createTextNode(
      'Unable to display framed document');
    new_body_element.appendChild(error_text_node);
  }

  // Replace the old frameset body with the new body
  // NOTE: this assumes the body is always located under the doc element,
  // i think that is ok? should maybe be stricter.
  doc.documentElement.replaceChild(new_body_element, body_element);

  // Remove any frame or frameset elements if somehow any remain
  const frame_elements = doc.querySelectorAll('frame, frameset');
  for(const frame_element of frame_elements)
    frame_element.remove();
}
