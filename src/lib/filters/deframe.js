// Removes frame content from a document. Also handles noframes elements.

export function deframe(document) {
  // If a document is framed then the root frame is its body, and document.body
  // points to it and not some <body> element
  // This is also true when document simply does not have a body. In this case
  // there is nothing to do.

  // This is also true when document is secretly xml-flagged. In this case
  // there is nothing to do.
  // TODO: although, if I wanted to support xhtml or something like that, maybe
  // i should try by using querySelector and looking for body/frameset/frame

  const original_body = document.body;
  if (!original_body) {
    return;
  }

  if (original_body.localName !== 'frameset') {
    return;
  }

  const new_body = document.createElement('body');

  // TODO: technically there could be multiple noframes elements? Should I
  // instead iterate through all of them and concatenate?
  const noframes_element = document.querySelector('noframes');
  if (noframes_element) {
    for (let node = noframes_element.firstChild; node;
         node = noframes_element.firstChild) {
      new_body.appendChild(node);
    }
  }

  if (!new_body.firstChild) {
    const error_node =
        document.createTextNode('Unable to display framed document');
    new_body.appendChild(error_node);
  }

  document.documentElement.replaceChild(new_body, original_body);

  const frames = document.querySelectorAll('frame, frameset');
  for (const frame of frames) {
    frame.remove();
  }
}
