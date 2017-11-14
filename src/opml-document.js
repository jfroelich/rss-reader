// OPML Document utilities

// TODO: drop the opmlDocument prefix, that is now a responsibility of the importing module

import assert from "/src/assert.js";
import {
  opmlOutlineElementToObject,
  opmlOutlineElementHasValidType,
  opmlOutlineElementHasXMLURL,
  opmlOutlineElementNormalizeXMLURL,
  opmlOutlineToElement
} from "/src/opml-outline.js";

// @throws Error missing head element
export function opmlDocumentSetTitle(doc, title) {
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

export function opmlDocumentCreate() {
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

export function opmlGetOutlineObjects(doc) {
  const elements = getOutlineElements(doc);
  const objects = [];
  for(const element of elements) {
    objects.push(opmlOutlineElementToObject(element));
  }
  return objects;
}

export function opmlRemoveOutlinesWithInvalidTypes(doc) {
  assert(doc instanceof Document);
  const elements = getOutlineElements(doc);
  const initialLength = elements.length;
  for(const element of elements) {
    if(!opmlOutlineElementHasValidType(element)) {
      element.remove();
    }
  }

  return initialLength - elements.length;
}

export function opmlRemoveOutlinesMissingXMLURLs(doc) {
  assert(doc instanceof Document);
  const outlines = getOutlineElements(doc);
  for(const outline of outlines) {
    if(!opmlOutlineElementHasXMLURL(outline)) {
      outline.remove();
    }
  }
}

export function opmlNormalizeOutlineXMLURLs(doc) {
  assert(doc instanceof Document);
  const outlines = getOutlineElements(doc);
  for(const outline of outlines) {
    opmlOutlineElementNormalizeXMLURL(outline);
  }
}

export function opmlDocumentAppendOutlineObject(doc, outline) {
  appendOutlineElement(doc, opmlOutlineToElement(doc, outline));
}

function getOutlineElements(doc) {
  assert(doc instanceof Document);
  return doc.querySelectorAll('opml > body > outline');
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
