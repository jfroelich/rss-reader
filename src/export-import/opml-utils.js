import assert from "/src/common/assert.js";

// TODO: define assert locally, decouple from assert.js

// Create a new OPML document
// @param title {String} optional document title
// @return {Document} an xml-flagged document
export function createDocument(title) {
  const doc = document.implementation.createDocument(null, 'opml', null);
  doc.documentElement.setAttribute('version', '2.0');

  const headElement = doc.createElement('head');
  doc.documentElement.appendChild(headElement);

  // TODO: setTitle isn't called anywhere, just create a title element here?
  if(title) {
    setTitle(doc, title);
  }

  const currentDate = new Date();
  const currentUTCString = currentDate.toUTCString();

  const dateCreatedElement = doc.createElement('datecreated');
  dateCreatedElement.textContent = currentUTCString;
  headElement.appendChild(dateCreatedElement);

  const dateModifiedElement = doc.createElement('datemodified');
  dateModifiedElement.textContent = currentUTCString;
  headElement.appendChild(dateModifiedElement);

  const docsElement = doc.createElement('docs');
  docsElement.textContent = 'http://dev.opml.org/spec2.html';
  headElement.appendChild(docsElement);

  const bodyElement = doc.createElement('body');
  doc.documentElement.appendChild(bodyElement);

  return doc;
}

function setTitle(doc, title) {
  assert(doc instanceof Document);
  const titleVarType = typeof title;
  assert(titleVarType === 'undefined' || titleVarType === 'string');

  let titleElement = doc.querySelector('title');
  if(title) {
    if(!titleElement) {
      titleElement = doc.createElement('title');
      const headElement = doc.querySelector('head');

      // TODO: if the head element is missing, then instead of throwing an error, create and append
      // the head element
      if(!headElement) {
        throw new Error('Missing head element');
      }

      headElement.appendChild(titleElement);
    }

    titleElement.textContent = title;
  } else {
    if(titleElement) {
      titleElement.remove();
    }
  }
}

export function getOutlineObjects(doc) {
  const elements = getOutlineElements(doc);
  const objects = [];
  for(const element of elements) {
    objects.push(outlineElementToObject(element));
  }
  return objects;
}

export function getOutlineElements(doc) {
  assert(doc instanceof Document);
  return doc.querySelectorAll('opml > body > outline');
}

export function appendOutlineObject(doc, outline) {
  appendOutlineElement(doc, outlineObjectToElement(doc, outline));
}

function appendOutlineElement(doc, element) {
  assert(doc instanceof Document);
  let bodyElement = doc.querySelector('body');
  if(!bodyElement) {
    bodyElement = doc.createElement('body');
    doc.documentElement.appendChild(bodyElement);
  }
  bodyElement.appendChild(element);
}

export function isOutline(outline) {
  return typeof outline === 'object' && outline !== null;
}

function outlineObjectToElement(doc, outline) {
  assert(doc instanceof Document);
  assert(isOutline(outline));

  const element = doc.createElement('outline');
  if(outline.type) {
    element.setAttribute('type', outline.type);
  }

  if(outline.xmlUrl) {
    element.setAttribute('xmlUrl', outline.xmlUrl);
  }

  if(outline.text) {
    element.setAttribute('text', outline.text);
  }

  if(outline.title) {
    element.setAttribute('title', outline.title);
  }

  if(outline.description) {
    element.setAttribute('description', outline.description);
  }

  if(outline.htmlUrl) {
    element.setAttribute('htmlUrl', outline.htmlUrl);
  }

  return element;
}

export function outlineElementToObject(element) {
  const object = {};
  object.description = element.getAttribute('description');
  object.htmlUrl = element.getAttribute('htmlUrl');
  object.text = element.getAttribute('text');
  object.title = element.getAttribute('title');
  object.type = element.getAttribute('type');
  object.xmlUrl = element.getAttribute('xmlUrl');
  return object;
}
