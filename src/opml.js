// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

// Lib for importing and exporting opml files
// Requires: /src/db.js
// Requires: /src/html.js
// Requires: /src/string.js

// TODO: i think my original idea of two libs, one just about opml, and
// one that deals with import/export and interaction with other components
// was better. right now this feels like it does too much, and isn't generic

// Creates and returns an opml document with the given title and containing
// the given feeds as outline elements
function opml_create_document(title, feeds) {
  'use strict';
  const doc = document.implementation.createDocument(null, 'OPML', null);
  const documentElement = doc.documentElement;
  documentElement.setAttribute('version', '2.0');

  const headElement = doc.createElement('HEAD');
  documentElement.appendChild(headElement);

  const titleElement = doc.createElement('TITLE');
  titleElement.textContent = title || '';
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
}

// Imports an array of files representing OPML documents. Calls callback when
// complete, with tracking information.
function opml_import_files(connection, files, callback) {
  'use strict';

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
    opml_import_file(files[i], connection, tracker, callback);
  }
}

function opml_import_file(file, connection, tracker, callback) {
  'use strict';

  // TODO: i think i might want to delegate some of this to a general
  // purpose file.js function file_read_as_text(file, callback) that passes
  // error, text to callback

  const reader = new FileReader();

  const onload = opml_on_file_load.bind(reader, connection, tracker, callback);
  reader.onload = onload;
  reader.onerror = onload;

  reader.readAsText(file);
}

function opml_on_file_load(connection, tracker, callback, event) {
  'use strict';

  tracker.filesImported++;

  // React to file loading error
  if(event.type === 'error') {
    tracker.errors.push(event);
    if(tracker.filesImported === tracker.numFiles) {
      callback(tracker);
    }
    return;
  }

  const reader = event.target;
  const text = reader.result;

  // Parse the file's text into an OPML document object
  let document = null;
  try {
    document = opml_parse_opml_string(text);
  } catch(exception) {

    tracker.errors.push(exception);
    if(tracker.filesImported === tracker.numFiles) {
      callback(tracker);
    }
    return;
  }


  let outlineElements = opml_select_outline_elements(document);

  if(!outlineElements.length) {
    if(tracker.filesImported === tracker.numFiles) {
      callback(tracker);
    }
    return;
  }

  // Parse the outline elements into feed objects
  let feeds = [];
  for(let i = 0, len = outlineElements.length, outline; i < len; i++) {
    outline = opml_parse_outline_element(outlineElements[i]);
    feeds.push(outline);
  }

  // Reduce the number of failed insert attempts before hitting the
  // the database
  feeds = opml_remove_duplicate_feeds(feeds);

  // TODO: should this be waiting for all storage calls to complete
  // before calling back?
  // TODO: db_store_feed should allow for a null callback argument
  // and handle it on its own, i shouldn't need to use a noop here
  for(let feed of feeds) {
    db_store_feed(connection, null, feed, opml_noop);
  }

  if(tracker.filesImported === tracker.numFiles) {
    callback(tracker);
  }
}

function opml_noop() {
  'use strict';
}

function opml_remove_duplicate_feeds(feeds) {
  'use strict';

  const pairs = feeds.map(function expand_feed(feed) {
    return [feed.url, feed];
  });

  const map = new Map(pairs);
  return map.values();
}

function opml_is_valid_outline_element(element) {
  'use strict';
  const TYPE_PATTERN = /rss|rdf|feed/i;
  const type = element.getAttribute('type');
  const url = element.getAttribute('xmlUrl') || '';
  return type && TYPE_PATTERN.test(type) && url.trim();
}

function opml_sanitize_string(inputString) {
  'use strict';

  // TODO: consider max length of each field and the behavior when
  // exceeded

  let outputString = inputString || '';
  if(outputString) {
    outputString = string_filter_controls(outputString);
    outputString = html_replace(outputString, '');
  }

  return outputString.trim();
}

function opml_parse_outline_element(element) {
  'use strict';

  let title = element.getAttribute('title') ||
    element.getAttribute('text');
  let description = element.getAttribute('description');
  let url = element.getAttribute('xmlUrl');
  let link = element.getAttribute('htmlUrl');

  const feed = {};
  feed.title = opml_sanitize_string(title);
  feed.description = opml_sanitize_string(description);
  feed.url = opml_sanitize_string(url);
  feed.link = opml_sanitize_string(link);
  return feed;
}

// Returns the first matching <body> element of an opml document, if one
// exists.
// TODO: this should probably delegate its functionality to some dom utility
// function (but that does not currently exist). In fact if that exists I
// should replace this function with that one in the calling context.
function opml_find_body_element(document) {
  'use strict';
  for(let element = document.documentElement.firstElementChild;
    element; element = node.nextElementSibling) {
    if(opml_is_body_element(element)) {
      return element;
    }
  }
}

// Returns an array of all <outline> elements found in the document
// that are immediate children of the document's <body> element and
// represent minimally valid feeds.
function opml_select_outline_elements(document) {
  'use strict';

  const elementsArray = [];
  const bodyElement = opml_find_body_element(document);
  if(!bodyElement) {
    return elementsArray;
  }

  // TODO: i think i may want to delegate iteration of an element's child
  // elements to some general purpose function like in dom.js
  // for_each_child_element ?

  for(let element = bodyElement.firstElementChild; element;
    element = node.nextElementSibling) {
    if(opml_is_outline_element(element) &&
      opml_is_valid_outline_element(element)) {
      elementsArray.push(element);
    }
  }

  return elementsArray;
}

// Parses a string into an opml document. Throws an exception if a parsing
// error occurs or the document is invalid. Otherwise, returns the document.
function opml_parse_opml_string(string) {
  'use strict';

  // Allow parsing exceptions to bubble up
  const document = opml_parse_xml_string(string);

  // document and document element are now guaranteed defined because
  // otherwise opml_parse_xml_string throws an exception

  // We still have to check that the xml document represents an opml document
  if(!opml_is_opml_element(document.documentElement)) {
    throw new Error('Invalid document element: ' +
      document.documentElement.nodeName);
  }

  return document;
}


// Returns true if the element is an <outline> element
function opml_is_outline_element(element) {
  'use strict';
  return string_equals_ignore_case(element.nodeName, 'OUTLINE');
}

// Returns true if the element is an <body> element
function opml_is_body_element(element) {
  'use strict';
  return string_equals_ignore_case(element.nodeName, 'BODY');
}

// Returns true if the element is an <opml> element
function opml_is_opml_element(element) {
  'use strict';
  return string_equals_ignore_case(element.nodeName, 'OPML');
}

// Parses a string into a document
function opml_parse_xml_string(string) {
  'use strict';

  // TODO: i think i want to move this back into a general purpose
  // xml.js file

  const parser = new DOMParser();
  const MIME_TYPE_XML = 'application/xml';
  const document = parser.parseFromString(string, MIME_TYPE_XML);

  if(!document) {
    throw new Error('Undefined document');
  }

  if(!document.documentElement) {
    throw new Error('Undefined document element');
  }

  const parserError = document.querySelector('parsererror');
  if(parserError) {
    throw new Error('Format error: ' + parserError.textContent);
  }

  return document;
}
