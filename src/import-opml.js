// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

const importOPML = {};

importOPML.start = function(callback) {
  console.debug('Importing OPML files...');

  // Create a context variable for simplified continuation calling
  const context = {
    'filesProcessed': 0,
    'callback': callback,
    'uploader': null
  };

  // Prompt for file upload
  context.uploader = document.createElement('input');
  context.uploader.setAttribute('type', 'file');
  context.uploader.style.display = 'none';
  context.uploader.onchange = importOPML.onUploaderChange.bind(this, context);
  const parentElement = document.body || document.documentElement;
  parentElement.appendChild(context.uploader);
  context.uploader.click();
};

importOPML.onUploaderChange = function(context, event) {
  context.uploader.removeEventListener('change', importOPML.onUploaderChange);
  const files = context.uploader.files;
  if(!files || !files.length) {
    console.warn('No files uploaded');
    importOPML.onComplete(context);
    return;
  }

  openIndexedDB(importOPML.onOpenDatabase.bind(null, context));
};

importOPML.onOpenDatabase = function(context, connection) {
  if(!connection) {
    console.error('Failed to connect to database during opml import');
    importOPML.onComplete(context);
    return;
  }

  console.debug('importOPML connected to database');
  context.connection = connection;

  const files = context.uploader.files;

  for(let file of files) {
    console.debug('Importing opml file', file.name);
    if(!importOPML.isMimeTypeXML(file.type)) {
      console.warn('Invalid mime type', file.name, file.type);
      importOPML.onFileProcessed(context, file);
      continue;
    }

    if(!file.size) {
      console.warn('The file %s is empty', file.name);
      importOPML.onFileProcessed(context, file);
      continue;
    }

    const reader = new FileReader();
    reader.onload = importOPML.readFileOnLoad.bind(reader, context, file);
    reader.onerror = importOPML.readFileOnError.bind(reader, context, file);
    reader.readAsText(file);
  }
};

importOPML.isMimeTypeXML = function(typeString) {
  return typeString && typeString.toLowerCase().includes('xml');
};

importOPML.readFileOnError = function(context, file, event) {
  console.warn('Error reading file', file.name, event);
  importOPML.onFileProcessed(context, file);
};

importOPML.readFileOnLoad = function(context, file, event) {
  console.debug('Loaded file', file.name);

  // Deserialize into an XMLDocument
  const parser = new DOMParser();
  const fileText = event.target.result;
  let document = null;
  try {
    document = parser.parseFromString(fileText, 'application/xml');
  } catch(xmlParseError) {
    console.warn(xmlParseError);
    importOPML.onFileProcessed(context, file);
    return;
  }

  // Check that document is defined
  if(!document) {
    console.warn('Reading file %s resulted in undefined document', file.name);
    importOPML.onFileProcessed(context, file);
    return;
  }

  // Check for an embedded error element
  const parserError = document.querySelector('parsererror');
  if(parserError) {
    console.warn('XML embedded parsing error', file.name,
      parserError.textContent);
    importOPML.onFileProcessed(context, file);
    return;
  }

  // Check the document element
  if(document.documentElement.localName !== 'opml') {
    console.warn('Not <opml>', file.name, document.documentElement.nodeName);
    importOPML.onFileProcessed(context, file);
    return;
  }

  // Check that the opml document has a body element
  // Due to quirks with xml, cannot use document.body
  const bodyElement = document.querySelector('body');
  if(!bodyElement) {
    console.warn('No body element', file.name,
      document.documentElement.outerHTML);
    importOPML.onFileProcessed(context, file);
    return;
  }

  // Add each of the outlines representing feeds in the body
  const seenURLStringSet = new Set();
  for(let element = bodyElement.firstElementChild; element;
    element = element.nextElementSibling) {

    if(element.localName !== 'outline') {
      continue;
    }

    // Skip outlines with the wrong type
    // TODO: should type be optional?
    let type = element.getAttribute('type');
    if(!type || type.length < 3 || !/rss|rdf|feed/i.test(type)) {
      console.warn('Invalid outline type', element.outerHTML);
      continue;
    }

    // Skip outlines without a url
    const urlString = (element.getAttribute('xmlUrl') || '').trim();
    if(!urlString) {
      console.warn('Outline missing url', element.outerHTML);
      continue;
    }

    // Skip outlines without a valid url
    let url = null;
    try {
      url = new URL(urlString);
    } catch(urlParseException) {
      console.warn('Outline url is invalid', element.outerHTML);
      continue;
    }

    // Skip duplicate outlines (compared by normalized url)
    if(seenURLStringSet.has(url.href)) {
      console.debug('Duplicate outline', element.outerHTML);
      continue;
    }
    seenURLStringSet.add(url.href);

    // Create the feed object to pass to addFeed
    const feed = {};
    Feed.prototype.addURL.call(feed, url.href);
    feed.type = type;
    feed.title = element.getAttribute('title') || element.getAttribute('text');
    feed.description = element.getAttribute('description');

    const htmlUrlString = element.getAttribute('htmlUrl');
    if(htmlUrlString) {
      let outlineLinkURL = null;
      try {
        outlineLinkURL = new URL(htmlUrlString);
        feed.link = outlineLinkURL.href;
      } catch(urlParseError) {
        console.warn('Error parsing outline link', htmlUrlString);
      }
    }

    // Request that the feed be added
    // Async. Do not wait for the request to complete.
    addFeed(context.connection, feed, null);
  }

  // Consider the file finished, even if addFeed requests are outstanding
  importOPML.onFileProcessed(context, file);
};

importOPML.onFileProcessed = function(context, file) {
  console.debug('Finished importing file', file.name);
  // Track that the file has been processed. This can only be incremented here
  // because sometimes this is called async
  context.filesProcessed++;

  if(context.filesProcessed === context.files.length) {
    console.debug('Finished importing %i files', context.files.length);
    importOPML.onComplete(context);
  }
};

importOPML.onComplete = function(context) {
  console.debug('Completed opml import');

  if(context.uploader && context.uploader.parentNode) {
    context.uploader.remove();
  }

  if(context.connection) {
    context.connection.close();
  }

  if(context.callback) {
    context.callback();
  }
};
