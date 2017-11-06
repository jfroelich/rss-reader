'use strict';

// import rbl.js
// import opml-outline.js

// @throws AssertionError
// @throws Error missing head element
function opmlDocumentSetTitle(doc, title) {
  assert(doc instanceof Document);

  const titleVarType = typeof title;
  assert(titleVarType === 'undefined' || titleVarType === 'string');

  let titleElement = doc.querySelector('title');
  if(title) {
    if(!titleElement) {
      titleElement = doc.createElement('title');
      const headElement = doc.querySelector('head');

      // TODO: instead of failing on not finding <head>, create
      // <head> if needed

      if(!headElement) {
        throw new Error('missing head element');
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

function opmlDocumentCreate() {
  const doc = document.implementation.createDocument(null, 'opml', null);
  doc.documentElement.setAttribute('version', '2.0');

  const headElement = doc.createElement('head');
  doc.documentElement.appendChild(headElement);

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

function opmlGetOutlineElements(doc) {
  assert(doc instanceof Document);
  return doc.querySelectorAll('opml > body > outline');
}

function opmlGetOutlineObjects(doc) {
  const elements = opmlGetOutlineElements(doc);
  const objects = [];
  for(const element of elements) {
    objects.push(opmlOutlineElementToObject(element));
  }
  return objects;
}

function opmlRemoveOutlinesWithInvalidTypes(doc) {
  assert(doc instanceof Document);
  const elements = opmlGetOutlineElements(doc);
  const initialLength = elements.length;
  for(const element of elements) {
    if(!opmlOutlineElementHasValidType(element)) {
      element.remove();
    }
  }

  return initialLength - elements.length;
}

function opmlRemoveOutlinesMissingXMLURLs(doc) {
  assert(doc instanceof Document);
  const outlines = opmlGetOutlineElements(doc);
  for(const outline of outlines) {
    if(!opmlOutlineElementHasXMLURL(outline)) {
      outline.remove();
    }
  }
}

function opmlNormalizeOutlineXMLURLs(doc) {
  assert(doc instanceof Document);
  const outlines = opmlGetOutlineElements(doc);
  for(const outline of outlines) {
    opmlOutlineElementNormalizeXMLURL(outline);
  }
}

function opmlDocumentAppendOutlineObject(doc, outline) {
  opmlDocumentAppendOutlineElement(doc, opmlOutlineToElement(doc, outline));
}

function opmlDocumentAppendOutlineElement(doc, element) {
  assert(doc instanceof Document);
  let bodyElement = doc.querySelector('body');
  if(!bodyElement) {
    bodyElement = doc.createElement('body');
    doc.documentElement.appendChild(bodyElement);
  }
  bodyElement.appendChild(element);
}
