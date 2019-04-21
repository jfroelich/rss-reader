// TODO: now that this is a library, this module is a misnomer. It is not exporting anything. It is
// simply generating a document. This should be renamed to something like createOPMLDocument, and
// helper function that currently occupies that name should either be inlined or renamed to
// something like createOPMLDocumentTemplate.
// TODO: I think the main function should be the default export. Outline is an optional type that
// the caller may not even care to use. Or, this should be exporting a class, and Outline should be
// a static (in the java sense not the c sense) member class.

export function Outline() {
  // The feed type (e.g. rss/atom)
  this.type = undefined;
  // The url of the feed xml file
  this.xmlUrl = undefined;
  // The title of the feed
  this.title = undefined;
  // The textual description of the feed
  this.description = undefined;
  // A related website location
  this.htmlUrl = undefined;
}

// Returns an in memory OPML document object filled with the given outlines. documentTitle is an
// optional dom string.
export async function exportOPML(outlines, documentTitle) {
  // The line breaks are so that the exported file is easier to debug at a glance

  const doc = createOPMLDocument(documentTitle);
  const bodyElement = doc.querySelector('body');
  bodyElement.append('\n');

  for (const outline of outlines) {
    const element = doc.createElement('outline');
    maybeSet(element, 'type', outline.type);
    maybeSet(element, 'xmlUrl', outline.xmlUrl);
    maybeSet(element, 'title', outline.title);
    maybeSet(element, 'description', outline.description);
    maybeSet(element, 'htmlUrl', outline.htmlUrl);
    bodyElement.append(element);
    bodyElement.append('\n');
  }

  return doc;
}

function maybeSet(element, name, value) {
  if (value) {
    element.setAttribute(name, value);
  }
}

function createOPMLDocument(documentTitle) {
  const doc = document.implementation.createDocument(null, 'opml', null);
  doc.documentElement.setAttribute('version', '2.0');

  const headElement = doc.createElement('head');
  doc.documentElement.append(headElement);

  if (documentTitle) {
    const titleElement = doc.createElement('title');
    titleElement.append(documentTitle);
    headElement.append(titleElement);
  }

  const currentDate = new Date();
  const currentDateUTCString = currentDate.toUTCString();

  const dateCreatedElement = doc.createElement('datecreated');
  dateCreatedElement.textContent = currentDateUTCString;
  headElement.append(dateCreatedElement);

  const dateModifiedElement = doc.createElement('datemodified');
  dateModifiedElement.textContent = currentDateUTCString;
  headElement.append(dateModifiedElement);

  const docsElement = doc.createElement('docs');
  docsElement.textContent = 'http://dev.opml.org/spec2.html';
  headElement.append(docsElement);

  const bodyElement = doc.createElement('body');
  doc.documentElement.append(bodyElement);
  return doc;
}
