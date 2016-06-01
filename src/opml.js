// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

// Lib for importing and exporting opml files
const OPML = {};

// Parses a string containing xml into an document. The document is
// XML-flagged, so node.nodeName is case-sensitive. Throws an exception when a
// parsing error occurs.
OPML.parseXML = function(xmlString) {
  const parser = new DOMParser();
  const MIME_TYPE_XML = 'application/xml';
  const document = parser.parseFromString(xmlString, MIME_TYPE_XML);

  // TODO: are document or documentElement ever undefined? I feel like
  // parseFromString guarantees they are defined or else it would throw
  // or something like that. Look into this.

  if(!document) {
    throw new Error('Undefined document');
  }

  if(!document.documentElement) {
    throw new Error('Undefined document element');
  }

  // Check for an implied parsing error
  const parserError = document.querySelector('PARSERERROR');
  if(parserError) {
    // The error has nested elements sometimes, so use textContent, not
    // innerHTML
    throw new Error('Format error: ' + parserError.textContent);
  }

  return document;
};

// Parses a string into an opml document. Throws an exception if a parsing
// error occurs or the document is invalid.
OPML.parseFromString = function(string) {
  const document = OPML.parseXML(string);
  const documentElement = document.documentElement;
  const nodeName = documentElement.nodeName;
  if(nodeName.toUpperCase() !== 'OPML') {
    throw new Error('Invalid document element: ' + nodeName);
  }
  return document;
};

// Creates and returns an opml document with the given title and containing
// the given feeds as outline elements
OPML.createDocument = function(titleString, feeds) {
  const doc = document.implementation.createDocument(null, 'OPML', null);
  const documentElement = doc.documentElement;
  documentElement.setAttribute('version', '2.0');

  const headElement = doc.createElement('HEAD');
  documentElement.appendChild(headElement);

  const titleElement = doc.createElement('TITLE');
  titleElement.textContent = titleString || '';
  headElement.appendChild(titleElement);

  const nowDate = new Date();
  const nowUTCString = nowDate.toUTCString();

  const dateCreatedElement = doc.createElement('DATECREATED');
  dateCreatedElement.textContent = nowUTCString;
  headElement.appendChild(dateCreatedElement);

  const dateModifiedElement = doc.createElement('DATEMODIFIED');
  dateModifiedElement.textContent = nowUTCString;
  headElement.appendChild(dateModifiedElement);

  const docsElement = doc.createElement('DOCS');
  docsElement.textContent = 'http://dev.opml.org/spec2.html';
  headElement.appendChild(docsElement);

  const bodyElement = doc.createElement('BODY');
  documentElement.appendChild(bodyElement);

  let outlineElement;
  for(let feed of feeds) {
    outlineElement = doc.createElement('OUTLINE');
    outlineElement.setAttribute('type', feed.type || 'rss');
    outlineElement.setAttribute('xmlUrl', feed.url);
    outlineElement.setAttribute('text', feed.title || '');
    outlineElement.setAttribute('title', feed.title || '');
    outlineElement.setAttribute('description', feed.description || '');
    outlineElement.setAttribute('htmlUrl', feed.link || '');
    bodyElement.appendChild(outlineElement);
  }

  return doc;
};

// Imports an array of files representing OPML documents. Calls callback when
// complete, with tracking information.
// TODO: this should show a notification before calling the callback. I think
// what i will do is create my own on_complete callback, have it call the
// callback argument here, and then pass around the on_complete to the
// helper continuation functions.
// TODO: i don't think this should be dealing directly with files. Something
// else should be responsible for loading the text of files. This should only
// be responsible for storing the feeds from a single file. To do this, I think
// I should have a separate lib devoted to export/import, and have that do
// all the file handling. This should just be given the contents of a file
// and import it. It should not even be aware of multiple files, because
// files should be imported independently because I think that is more
// scalable. I think it should just accept a File argument, a connection,
// and a callback. It should just import that one file.
// TODO: the logic of tracking progress of importing all the files
// should not be a concern within the import-opml-file lib, it should just
// call a callback when it is done. The caller can design the callback to
// do the checks for whether all files were imported.
OPML.importFiles = function(connection, files, callback) {
  const tracker = {
    errors: [],
    numFiles: files.length,
    filesImported: 0
  };

  // TODO: rather than pass around the callback, have each early exit
  // call onImportComplete, which then checks tracker if all files imported
  // and calls callback. Then bind callback once to onImportComplete
  // and pass that around.

  const numFiles = files.length;
  for(let i = 0; i < numFiles; i++) {
    OPML.importFile(files[i], connection, tracker, callback);
  }
};

OPML.importFile = function(file, connection, tracker, callback) {
  const reader = new FileReader();
  const onload = OPML.onFileLoad.bind(reader, connection, tracker, callback);
  reader.onload = onload;
  reader.onerror = onload;
  reader.readAsText(file);
};

OPML.onFileLoad = function(connection, tracker, callback, event) {
  tracker.filesImported++;

  // React to file read error
  if(event.type === 'error') {
    // TODO: should this be accessing a property of the event instead of
    // the event itself? I need to see what the error actually looks like
    tracker.errors.push(event);
    if(tracker.filesImported === tracker.numFiles) {
      callback(tracker);
    }
    return;
  }

  const reader = event.target;
  const text = reader.result;

  // Parse the text into an OPML document
  let document = null;
  try {
    document = OPML.parseFromString(text);
  } catch(exception) {
    tracker.errors.push(exception);
    if(tracker.filesImported === tracker.numFiles) {
      callback(tracker);
    }
    return;
  }

  let outlineElements = OPML.findOutlineElements(document);
  outlineElements = outlineElements.filter(OPML.isValidOutlineElement);

  if(!outlineElements.length) {
    if(tracker.filesImported === tracker.numFiles) {
      callback(tracker);
    }
    return;
  }

  // Parse the outline elements into feed objects
  let feeds = [];
  for(let i = 0, len = outlineElements.length, outline; i < len; i++) {
    outline = OPML.parseOutlineElement(outlineElements[i]);
    feeds.push(outline);
  }

  // Reduce the number of failed insert attempts before hitting the
  // the database
  feeds = OPML.removeDuplicateFeeds(feeds);

  // NOTE: unlike subscriptions, I am not checking for a failure to insert
  // a new feed because a feed with a similar url already exists, at least,
  // i think. i need to go back and look at this again.

  // TODO: should this be waiting for all storage calls to complete
  // before calling back?

  for(let feed of feeds) {
    Feed.put(connection, null, feed, null);
  }

  if(tracker.filesImported === tracker.numFiles) {
    callback(tracker);
  }
};

OPML.expandFeedObjectToPair = function(feed) {
  return [feed.url, feed];
};

OPML.removeDuplicateFeeds = function(feedsArray) {
  const expandedFeedsArray = feedsArray.map(OPML.expandFeedObjectToPair);
  const map = new Map(expandedFeedsArray);
  return map.values();
};

// TODO: validate the url?
OPML.isValidOutlineElement = function(element) {
  const TYPE_PATTERN = /rss|rdf|feed/i;
  const type = element.getAttribute('type');
  const url = element.getAttribute('xmlUrl') || '';
  return type && TYPE_PATTERN.test(type) && url.trim();
};

// TODO: consider max length of each field and the behavior when exceeded
OPML.sanitizeString = function(inputString) {
  let outputString = inputString || '';
  if(outputString) {
    outputString = utils.string.filterControlCharacters(outputString);
    outputString = HTMLUtils.replaceTags(outputString, '');
  }
  return outputString.trim();
};

// TODO: should caller be responsible for sanitizing?
OPML.parseOutlineElement = function(element) {
  let title = element.getAttribute('title') ||
    element.getAttribute('text');
  let description = element.getAttribute('description');
  let url = element.getAttribute('xmlUrl');
  let link = element.getAttribute('htmlUrl');

  const outline = {};
  outline.title = OPML.sanitizeString(title);
  outline.description = OPML.sanitizeString(description);
  outline.url = OPML.sanitizeString(url);
  outline.link = OPML.sanitizeString(link);
  return outline;
};

// Returns the first matching <body> element of an opml document
OPML.findBodyElement = function(document) {
  for(let element = document.documentElement.firstElementChild;
    element; element = element.nextElementSibling) {
    if(element.nodeName.toUpperCase() === 'BODY') {
      return element;
    }
  }
};

// Returns an array of all <outline> elements found in the document
// that are immediate children of the document's <body> element.
OPML.findOutlineElements = function(document) {
  const outlineArray = [];
  const bodyElement = OPML.findBodyElement(document);
  if(bodyElement) {
    for(let element = bodyElement.firstElementChild; element;
      element = element.nextElementSibling) {
      if(element.nodeName.toUpperCase() === 'OUTLINE') {
        outlineArray.push(element);
      }
    }
  }
  return outlineArray;
};
