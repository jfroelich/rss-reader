
import assert from "/src/assert.js";

// Removes frame content from a document
// @param doc {Document} the document to inspect and modify
export default function frameFilter(doc) {
  assert(doc instanceof Document);

  // It is a bit counterintuitive but if a document is framed then the root frame is its body,
  // and doc.body points to it (and not some <body> element)

  let originalBody = doc.body;
  if(!originalBody) {
    return;
  }

  // If document is not framed, then nothing else to do
  if(originalBody.localName !== 'frameset') {
    return;
  }

  // The document is framed, transform into unframed
  let newBody = doc.createElement('body');

  // If available, move noframes content into the new body.
  const noframesElement = doc.querySelector('noframes');
  if(noframesElement) {
    for(let node = noframesElement.firstChild; node; node = noframesElement.firstChild) {
      newBody.appendChild(node);
    }
  }

  // If the new body is empty, add an error message about framed content
  if(!newBody.firstChild) {
    const errorNode = doc.createTextNode('Unable to display framed document');
    newBody.appendChild(errorNode);
  }

  // Replace the old frameset body with the new body
  // TODO: this assumes the body is always located under the doc element, I think that is ok? Should
  // maybe be stricter.
  doc.documentElement.replaceChild(newBody, originalBody);

  // Remove any frame or frameset elements if somehow any remain
  const frames = doc.querySelectorAll('frame, frameset');
  for(const frame of frames) {
    frame.remove();
  }
}
