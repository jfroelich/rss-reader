// See license.md
'use strict';

// TODO: maybe eventually make async and merge frames into single document
// TODO: maybe inline iframes somehow, or replace with a message instead of
// removing
// TODO: write tests

function process_framed_document(doc) {

  let body_element = doc.body;
  if(!body_element)
    return;

  // Remove iframes
  let elements = doc.querySelectorAll('iframe');
  for(const element of elements)
    element.remove();

  if(body_element.localName !== 'frameset')
    return;


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
  doc.documentElement.replaceChild(new_body_element, body_element);

  // Remove any frame or frameset elements if somehow any remain
  elements = doc.querySelectorAll('frame, frameset');
  for(const element of elements)
    element.remove();

}
