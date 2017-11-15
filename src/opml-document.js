// OPML Document utilities

import assert from "/src/assert.js";
import {check} from "/src/errors.js";
import * as OPMLOutline from "/src/opml-outline.js";

export function setTitle(doc, title) {
  assert(doc instanceof Document);

  const titleVarType = typeof title;
  assert(titleVarType === 'undefined' || titleVarType === 'string');

  let titleElement = doc.querySelector('title');
  if(title) {
    if(!titleElement) {
      titleElement = doc.createElement('title');
      const headElement = doc.querySelector('head');

      // TODO: if the head element is missing, then instead of throwing an error, create and
      // append the head element
      check(headElement, undefined, 'opml document missing head element');
      headElement.appendChild(titleElement);
    }

    titleElement.textContent = title;
  } else {
    if(titleElement) {
      titleElement.remove();
    }
  }
}

// TODO: add title parameter, internally call setTitle if title set
export function create() {
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

export function getOutlineObjects(doc) {
  const elements = getOutlineElements(doc);
  const objects = [];
  for(const element of elements) {
    objects.push(OPMLOutline.fromElement(element));
  }
  return objects;
}

function getOutlineElements(doc) {
  assert(doc instanceof Document);
  return doc.querySelectorAll('opml > body > outline');
}

export function removeOutlinesWithInvalidTypes(doc) {
  assert(doc instanceof Document);
  const elements = getOutlineElements(doc);
  const initialLength = elements.length;
  for(const element of elements) {
    if(!OPMLOutline.elementHasValidType(element)) {
      element.remove();
    }
  }

  return initialLength - elements.length;
}

export function removeOutlinesMissingXMLURLs(doc) {
  assert(doc instanceof Document);
  const outlines = getOutlineElements(doc);
  for(const outline of outlines) {
    if(!OPMLOutline.elementHasXMLURL(outline)) {
      outline.remove();
    }
  }
}

export function normalizeOutlineXMLURLs(doc) {
  assert(doc instanceof Document);
  const outlines = getOutlineElements(doc);
  for(const outline of outlines) {
    OPMLOutline.elementNormalizeXMLURL(outline);
  }
}

export function appendOutlineObject(doc, outline) {
  appendOutlineElement(doc, OPMLOutline.toElement(doc, outline));
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
