// Simple OPML library

export function createDocument(documentTitle) {
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

export function appendOutlines(document, outlines) {
  // document.body does not work for xml
  const bodyElement = document.querySelector('body');
  for (const outline of outlines) {
    const element = document.createElement('outline');
    element.setAttribute('type', outline.type || '');
    element.setAttribute('xmlUrl', outline.xmlUrl || '');
    element.setAttribute('title', outline.title || '');
    element.setAttribute('description', outline.description || '');
    element.setAttribute('htmlUrl', outline.htmlUrl || '');
    bodyElement.append(element);
  }
}
