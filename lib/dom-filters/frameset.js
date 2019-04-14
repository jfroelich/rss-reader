// Removes frame-related content from a document, including frameset, frame, and noframes, but
// excluding iframes. The default message is appended to the body element when applying this filter
// results in producing an otherwise empty body element (when frames actually removed).
export default function transform(document, defaultMessage = 'Framed content not supported') {
  const framesetElement = document.querySelector('frameset');

  // Ensure nothing frame-related is left even without a frameset and regardless of location in the
  // hierarchy.
  if (!framesetElement) {
    const elements = document.querySelectorAll('frame, noframes');
    for (const element of elements) {
      element.remove();
    }
    return;
  }

  // If there is a frameset, first look for an existing body element. Do not use the document.body
  // shortcut because it will match frameset. This is trying to handle the malformed html case. If
  // there is a body, clear it out so that it is setup for reuse. If there is no body, create one in
  // replace of the original frameset.
  let bodyElement = document.querySelectorAll('body');
  if (bodyElement) {
    // There is both a frameset and a body, which is malformed html. Keep the body and pitch the
    // frameset.
    framesetElement.remove();

    // If a body element existed in addition to the frameset element, clear it out. This is
    // malformed html.
    let child = bodyElement.firstChild;
    while (child) {
      bodyElement.removeChild(child);
      child = bodyElement.firstChild;
    }
  } else {
    // There is a frameset and there is no body element. Removing the frameset will leave the
    // document without a body. Since we have a frameset and no body, create a new body element in
    // place of the frameset. This will detach the existing frameset. This assumes there is only one
    // frameset.
    bodyElement = document.createElement('body');

    const newChild = bodyElement;
    const oldChild = framesetElement;
    document.documentElement.replaceChild(newChild, oldChild);
  }

  // noframes, if present, should be nested within frameset in well-formed html. Now look for
  // noframes elements within the detached frameset, and if found, move their contents into the body
  // element. I am not sure if there should only be one noframes element or multiple are allowed, so
  // just look for all.
  const noframesElements = framesetElement.querySelectorAll('noframes');
  for (const noframesElement of noframesElements) {
    for (let node = noframesElement.firstChild; node; node = noframesElement.firstChild) {
      bodyElement.append(node);
    }
  }

  // Ensure nothing frame related remains, as a minimal guarantee, given the possibility of
  // malformed html. This also handles the multiple framesets malformed case.
  const elements = document.querySelectorAll('frame, frameset, noframes');
  for (const element of elements) {
    element.remove();
  }

  // Avoid producing an empty body without an explanation. Note that we know something frame-related
  // happened because we would have exited earlier without a frameset, so this is not going to
  // affect to the empty-body case in a frameless document.
  if (!bodyElement.firstChild) {
    bodyElement.append(defaultMessage);
  }
}
