// Removes frame content from a document. Also handles noframes elements.
export function deframe(document) {
  // A legal document should only have 1 frameset element. If it has more than
  // one, we ignore the rest after the first. If there is no frameset element
  // in the document, ensure no other frame-related elements remain, and exit.
  // We are intentionally not using the document.body shortcut because of the
  // extra complexity with xml documents and how frameset matches the shortcut.
  const frameset_element = document.querySelector('frameset');
  if (!frameset_element) {
    // Ensure no frame elements located outside of frameset remain in malformed
    // html
    const frame_elements = document.querySelectorAll('frame');
    for (const frame_element of frame_elements) {
      frame_element.remove();
    }

    // Ensure no noframes elements located outside of frameset remain in
    // malformed html
    const noframes_elements = document.querySelectorAll('noframes');
    for (const noframes_element of noframes_elements) {
      noframes_element.remove();
    }

    return;
  }

  // NOTE: the following transformations are not optimized for live document
  // modification. In other words, assume the document is inert.

  // If there is a frameset, first look for an existing body element. Do not
  // use the document.body shortcut because it will match frameset. This is
  // trying to handle the malformed html case. If there is a body, clear it out
  // so that it is setup for reuse. If there is no body, create one in replace
  // of the original frameset.

  let body_element = document.querySelectorAll('body');
  if (body_element) {
    frameset_element.remove();

    // If a body element existed in addition to the frameset element, clear it
    // out. This is malformed html.
    let child = body_element.firstChild;
    while (child) {
      body_element.removeChild(child);
      child = body_element.firstChild;
    }
  } else {
    // Removing the frameset will leave the document without a body. Since we
    // have a frameset and no body, create a new body element in place of the
    // frameset. This will detach the existing frameset. Again this assumes
    // there is only one frameset.
    body_element = document.createElement('body');
    // Confusing parameter order note: replaceChild(new child, old child)
    document.documentElement.replaceChild(body_element, frameset_element);
  }

  // Now look for noframes elements within the detached frameset, and if found,
  // move their contents into the body element. I am not sure if there should
  // only be one noframes element or multiple are allowed, so just look for all.
  const noframes_elements = frameset_element.querySelectorAll('noframes');
  for (const e of noframes_elements) {
    for (let node = e.firstChild; node; node = e.firstChild) {
      body_element.appendChild(node);
    }
  }

  // Ensure nothing frame related remains, as a minimal filter guarantee, given
  // the possibility of malformed html
  const elements = document.querySelectorAll('frame, frameset, noframes');
  for (const element of elements) {
    element.remove();
  }

  // Avoid producing an empty body without an explanation
  if (!body_element.firstChild) {
    const message = 'Unable to display document because it uses HTML frames';
    const node = document.createTextNode(message);
    body_element.appendChild(node);
  }
}
