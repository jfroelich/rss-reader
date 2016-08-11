// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

const importOPML = {};

importOPML.start = function(callback) {
  console.debug('Importing OPML files...');

  // Create a context variable for simplified continuation calling
  const context = {
    'numFilesProcessed': 0,
    'callback': callback,
    'uploader': null
  };

  // Prompt for file upload
  const uploader = document.createElement('input');
  context.uploader = uploader;
  uploader.setAttribute('type', 'file');
  uploader.style.display = 'none';
  uploader.onchange = importOPML.onUploaderChange.bind(null, context);
  const parentElement = document.body || document.documentElement;
  parentElement.appendChild(uploader);
  uploader.click();
};

importOPML.onUploaderChange = function(context, event) {
  context.uploader.removeEventListener('change', importOPML.onUploaderChange);
  if(!context.uploader.files || !context.uploader.files.length) {
    console.warn('No files uploaded');
    importOPML.onComplete(context);
    return;
  }

  openIndexedDB(importOPML.onOpenDatabase.bind(null, context));
};

importOPML.onOpenDatabase = function(context, connection) {
  if(connection) {
    context.connection = connection;
  } else {
    importOPML.onComplete(context);
    return;
  }

  for(let file of context.uploader.files) {
    console.debug('Importing opml file', file.name);
    if(file.type && !file.type.toLowerCase().includes('xml')) {
      console.warn('Invalid mime type', file.name, file.type);
      importOPML.onFileProcessed(context, file);
      continue;
    }

    if(!file.size) {
      console.warn('Empty file %s', file.name);
      importOPML.onFileProcessed(context, file);
      continue;
    }

    const reader = new FileReader();
    reader.onload = importOPML.readFileOnLoad.bind(reader, context, file);
    reader.onerror = importOPML.readFileOnError.bind(reader, context, file);
    reader.readAsText(file);
  }
};

importOPML.readFileOnError = function(context, file, event) {
  console.warn(file.name, event);
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

  // Ensure document is defined
  if(!document) {
    console.warn('Undefined document', file.name);
    importOPML.onFileProcessed(context, file);
    return;
  }

  // Check for an embedded error element
  const parserError = document.querySelector('parsererror');
  if(parserError) {
    console.warn(file.name, parserError.textContent);
    importOPML.onFileProcessed(context, file);
    return;
  }

  // Check the document element
  if(document.documentElement.localName !== 'opml') {
    console.warn('Not opml', file.name, document.documentElement.nodeName);
    importOPML.onFileProcessed(context, file);
    return;
  }

  // Check that the opml document has a body element
  // Due to quirks with xml, cannot use document.body
  const body = document.querySelector('body');
  if(!body) {
    console.warn('No body', file.name, document.documentElement.outerHTML);
    importOPML.onFileProcessed(context, file);
    return;
  }

  // Add each of the outlines representing feeds in the body
  const seenURLStringSet = new Set();
  for(let element = body.firstElementChild; element;
    element = element.nextElementSibling) {
    if(element.localName !== 'outline') {
      continue;
    }

    // Skip outlines with an unsupported type
    const type = element.getAttribute('type');
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
      console.warn('Invalid url', element.outerHTML);
      continue;
    }

    // Skip duplicate outlines (compared by normalized url)
    if(seenURLStringSet.has(url.href)) {
      console.debug('Duplicate', element.outerHTML);
      continue;
    }
    seenURLStringSet.add(url.href);

    // Create the feed object to pass to subscription.add
    const feed = new Feed();
    feed.addURL(url);
    feed.type = type;
    feed.title = element.getAttribute('title');
    if(!feed.title) {
      feed.title = element.getAttribute('text');
    }
    feed.description = element.getAttribute('description');

    const htmlUrlString = element.getAttribute('htmlUrl');
    if(htmlUrlString) {
      let outlineLinkURL = null;
      try {
        feed.link = new URL(htmlUrlString);
      } catch(urlParseError) {
        console.warn(urlParseError);
      }
    }

    // Subscribe to the feed
    // Async. Do not wait for the request to complete.
    subscription.add(feed, {
      'connection': context.connection,
      'suppressNotifications': true
    });
  }

  // Consider the file finished. subscription requests are pending
  importOPML.onFileProcessed(context, file);
};

importOPML.onFileProcessed = function(context, file) {
  console.debug('Finished importing file', file.name);
  // Track that the file has been processed. This can only be incremented here
  // because sometimes this is called async
  context.numFilesProcessed++;

  if(context.numFilesProcessed === context.files.length) {
    // Call onComplete. subscription requests may be pending
    importOPML.onComplete(context);
  }
};

importOPML.onComplete = function(context) {
  console.debug('Processed %i files', context.files.length);

  if(context.uploader) {
    context.uploader.remove();
  }

  // Request the connection be closed once pending subscription requests
  // complete
  if(context.connection) {
    context.connection.close();
  }

  // Callback, even if subscription requests are pending, and the connection is
  // still open.
  if(context.callback) {
    context.callback();
  }
};
