// See license.md

'use strict';

// Represents an OPML document. Provides functions for creating an OPML
// document from an xml string or using a basic template, for appending
// outline elements, and for serializing into a blob
function OPMLDocument() {
  this.documentObject = null;
}

// Creates and returns a new OPMLDocument instance.
OPMLDocument.parse = function(string) {
  const parser = new DOMParser();
  const documentObject = parser.parseFromString(string, 'application/xml');

  const errorElement = documentObject.querySelector('parsererror');
  if(errorElement) {
    throw new Error(errorElement.textContent);
  }

  const rootName = documentObject.documentElement.localName;
  if(rootName !== 'opml') {
    throw new Error(`Invalid document element: ${rootName}`);
  }

  const opmlDocument = new OPMLDocument();
  opmlDocument.documentObject = documentObject;
  return opmlDocument;
};

// Create and return a new OPMLDocument instance with a default template
OPMLDocument.create = function(titleString) {
  const documentObject = document.implementation.createDocument(
    null, 'opml', null);

  documentObject.documentElement.setAttribute('version', '2.0');

  const headElement = documentObject.createElement('head');
  documentObject.documentElement.appendChild(headElement);

  if(titleString) {
    const titleElement = documentObject.createElement('title');
    titleElement.textContent = titleString;
    headElement.appendChild(titleElement);
  }

  const currentDate = new Date();
  const currentDateUTCString = currentDate.toUTCString();

  const dateCreatedElement = documentObject.createElement('datecreated');
  dateCreatedElement.textContent = currentDateUTCString;
  headElement.appendChild(dateCreatedElement);

  const dateModifiedElement = documentObject.createElement('datemodified');
  dateModifiedElement.textContent = currentDateUTCString;
  headElement.appendChild(dateModifiedElement);

  const docsElement = documentObject.createElement('docs');
  docsElement.textContent = 'http://dev.opml.org/spec2.html';
  headElement.appendChild(docsElement);

  const bodyElement = documentObject.createElement('body');
  documentObject.documentElement.appendChild(bodyElement);

  const opmlDocument = new OPMLDocument();
  opmlDocument.documentObject = documentObject;
  return opmlDocument;
};

OPMLDocument.prototype.selectOutlineElements = function() {
  return this.documentObject.querySelectorAll('opml > body > outline');
};

OPMLDocument.prototype.getOutlineObjects = function() {
  const elements = this.selectOutlineElements();
  const objects = new Array(elements.length);
  for(let element of elements) {
    const object = this.createOutlineObject(element);
    objects.push(object);
  }
  return objects;
};

OPMLDocument.prototype.appendOutlineObject = function(outlineObject) {
  const outlineElement = this.createOutlineElement(outlineObject);
  this.appendOutlineElement(outlineElement);
};

OPMLDocument.prototype.appendOutlineElement = function(outlineElement) {
  let bodyElement = this.documentObject.querySelector('body');

  if(!bodyElement) {
    bodyElement = this.documentObject.createElement('body');
    this.documentObject.documentElement.appendChild(bodyElement);
  }

  bodyElement.appendChild(outlineElement);
};

OPMLDocument.prototype.createOutlineElement = function(outlineObject) {
  const outlineElement = this.documentObject.createElement('outline');
  if(outlineObject.type) {
    outlineElement.setAttribute('type', outlineObject.type);
  }

  if(outlineObject.xmlUrl) {
    outlineElement.setAttribute('xmlUrl', outlineObject.xmlUrl);
  }

  if(outlineObject.text) {
    outlineElement.setAttribute('text', outlineObject.text);
  }

  if(outlineObject.title) {
    outlineElement.setAttribute('title', outlineObject.title);
  }

  if(outlineObject.description) {
    outlineElement.setAttribute('description', outlineObject.description);
  }

  if(outlineObject.htmlUrl) {
    outlineElement.setAttribute('htmlUrl', outlineObject.htmlUrl);
  }

  return outlineElement;
};

OPMLDocument.prototype.createOutlineObject = function(outlineElement) {
  const outlineObject = {};
  outlineObject.description = outlineElement.getAttribute('description');
  outlineObject.htmlUrl = outlineElement.getAttribute('htmlUrl');
  outlineObject.text = outlineElement.getAttribute('text');
  outlineObject.title = outlineElement.getAttribute('title');
  outlineObject.type = outlineElement.getAttribute('type');
  outlineObject.xmlUrl = outlineElement.getAttribute('xmlUrl');
  return outlineObject;
};

OPMLDocument.prototype.toBlob = function() {
  const writer = new XMLSerializer();
  const opmlString = writer.serializeToString(this.documentObject);
  const blobObject = new Blob([opmlString], {'type': 'application/xml'});
  return blobObject;
};
