// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

// @param title {String} the value of the title element
// @param outlines {Array} an array of outline objects
// @returns {Document} an OPML document
function createOPMLDocument(title, outlines) {
  'use strict';
  const doc = document.implementation.createDocument(null, null);
  const documentElement = doc.createElement('opml');
  documentElement.setAttribute('version', '2.0');

  const headElement = doc.createElement('head');
  documentElement.appendChild(headElement);

  const titleElement = doc.createElement('title');
  titleElement.textContent = title || '';
  headElement.appendChild(titleElement);

  const nowDate = new Date();
  const nowUTCString = nowDate.toUTCString();

  const dateCreatedElement = doc.createElement('dateCreated');
  dateCreatedElement.textContent = nowUTCString;
  headElement.appendChild(dateCreatedElement);

  const dateModifiedElement = doc.createElement('dateModified');
  dateModifiedElement.textContent = nowUTCString;
  headElement.appendChild(dateModifiedElement);

  const docsElement = doc.createElement('docs');
  docsElement.textContent = 'http://dev.opml.org/spec2.html';
  headElement.appendChild(docsElement);

  const bodyElement = doc.createElement('body');
  documentElement.appendChild(bodyElement);

  // Generate outline elements
  const outlineElements = outlines.map(function(outline) {
    const outlineElement = document.createElement('outline');
    outlineElement.setAttribute('type', outline.type || 'rss');
    outlineElement.setAttribute('xmlUrl', outline.url);

    if(outline.title) {
      outlineElement.setAttribute('text', outline.title);
      outlineElement.setAttribute('title', outline.title);
    }

    if(outline.description) {
      outlineElement.setAttribute('description', outline.description);
    }

    if(outline.link) {
      outlineElement.setAttribute('htmlUrl', outline.link);
    }

    return outlineElement;
  });

  for(let outlineElement of outlineElements) {
    bodyElement.appendChild(outlineElement);
  }

  return doc;
}
