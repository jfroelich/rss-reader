// Removes frame content from a document. Also handles noframes elements.
// Throws an error if document is not a Document.
// Assumes the document is not somehow modified concurrently.
// Mutation is done in place because cloning the document is cost-prohibitive.

// TODO: a Document object may be internally flagged as xml or html, and
// browsers tend not to expose this fact. I cannot use an extra parameter to
// indicate whether the document is flagged one way or another, because this
// would require the caller to know the type, and that is an undue burden.
// document.body is defined for html-flagged documents but is undefined for
// xml-flagged documents. This currently exits when document.body is undefined.
// Therefore this currently exits early when the document is xml-flagged.
// Consider whether I want to support xml documents as well. In that case I need
// to redesign how the check works. querySelector for example will still work, I
// know this because I ran into this issue somewhere else, I think in the opml
// import stuff.

// TODO: technically there could be multiple noframes elements? Currently this
// only looks at the first element. Should this instead iterate through all of
// them and concatenate (well, move them sequentially)? I need to look at the
// html spec, or how similar programs have answered this.

// TODO: do I want to encapsulate the noframes section into its own helper
// function, or is that over-organization? Would it increase or decrease
// readability or maintenance-difficulty or debugability?

// TODO: add support for console parameter and add some logging

// TODO: the check for remaining frames at the end feels unclear, given that
// the function appears to have handled all such cases already. Perhaps it is
// worthy of a comment. Or moreso a review of how it actually works, because it
// might be stupid.


export function deframe(document) {
  // If a document is framed then the root frame is its body, and document.body
  // points to it and not some <body> element
  // This is also true when document simply does not have a body. In this case
  // there is nothing to do.
  // This is also true when document is secretly xml-flagged. In this case
  // there is nothing to do.
  const original_body = document.body;
  if (!original_body) {
    return;
  }

  if (original_body.localName !== 'frameset') {
    return;
  }

  const new_body = document.createElement('body');


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
