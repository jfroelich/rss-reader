// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

(function(exports, openIndexedDB, Subscription, Feed) {
'use strict';

function imp(callback) {
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
  uploader.onchange = impOnUploaderChange.bind(context);
  const parentElement = document.body || document.documentElement;
  parentElement.appendChild(uploader);
  uploader.click();
}

function impOnUploaderChange(event) {
  this.uploader.removeEventListener('change', impOnUploaderChange);
  if(!this.uploader.files || !this.uploader.files.length) {
    console.warn('Received change event but no files uploaded');
    impOnComplete.call(this);
    return;
  }

  openIndexedDB(impOnOpenDatabase.bind(this));
}

function impOnOpenDatabase(connection) {
  if(connection) {
    this.connection = connection;
  } else {
    impOnComplete.call(this);
    return;
  }

  for(let file of this.uploader.files) {
    console.debug('Importing opml file', file.name);
    if(file.type && !file.type.toLowerCase().includes('xml')) {
      console.warn('Invalid mime type', file.name, file.type);
      impOnFileProcessed.call(this, file);
    } else if(!file.size) {
      console.warn('Empty file %s', file.name);
      impOnFileProcessed.call(this, file);
    } else {
      const reader = new FileReader();
      reader.onload = impReadFileOnLoad.bind(this, file);
      reader.onerror = impReadFileOnError.bind(this, file);
      reader.readAsText(file);
    }
  }
}

function impReadFileOnError(file, event) {
  console.warn(file.name, event);
  impOnFileProcessed.call(this, file);
}

function impReadFileOnLoad(file, event) {
  console.debug('Parsing the text of file', file.name);

  // Deserialize into an XMLDocument
  const parser = new DOMParser();
  const fileText = event.target.result;
  let document = null;
  try {
    document = parser.parseFromString(fileText, 'application/xml');
  } catch(xmlParseError) {
    console.warn(xmlParseError);
    impOnFileProcessed.call(this, file);
    return;
  }

  // Ensure document is defined
  if(!document) {
    console.warn('Undefined document', file.name);
    impOnFileProcessed.call(this, file);
    return;
  }

  // Check for an embedded error
  const parserError = document.querySelector('parsererror');
  if(parserError) {
    console.warn(file.name, parserError.textContent);
    impOnFileProcessed.call(this, file);
    return;
  }

  // Check the document element
  if(document.documentElement.localName !== 'opml') {
    console.warn('Not opml', file.name, document.documentElement.nodeName);
    impOnFileProcessed.call(this, file);
    return;
  }

  // Check that the opml document has a body element. I do not know why
  // accessing document.body yields undefined, so to work around that, this
  // uses querySelector. There may be pathological cases such as when there are
  // multiple body elements where this does not mirror how the browser
  // identifies a document's body element.
  const body = document.querySelector('body');
  if(!body) {
    console.warn('No body', file.name, document.documentElement.outerHTML);
    impOnFileProcessed.call(this, file);
    return;
  }

  // Add each of the outlines representing feeds in the body
  const seenURLs = new Set();
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
    if(seenURLs.has(url.href)) {
      console.debug('Duplicate', element.outerHTML);
      continue;
    }
    seenURLs.add(url.href);

    // Create a Feed object
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

    // Subscribe to the feed. Async. Do not wait for the subscription request to
    // complete.
    Subscription.add(feed, {
      'connection': this.connection,
      'suppressNotifications': true
    });
  }

  // Consider the file finished. subscription requests are pending
  impOnFileProcessed.call(this, file);
}

function impOnFileProcessed(file) {
  console.debug('Finished processing file', file.name);
  // Track that the file has been processed. This can only be incremented here
  // because sometimes this is called async
  this.numFilesProcessed++;

  if(this.numFilesProcessed === this.uploader.files.length) {
    // Call onComplete. subscription requests may be pending
    impOnComplete.call(this);
  }
}

function impOnComplete() {
  console.debug('Processed %i files', this.uploader.files.length);

  if(this.uploader) {
    this.uploader.remove();
  }

  // Request the connection be closed once pending subscription requests
  // complete
  if(this.connection) {
    this.connection.close();
  }

  // Callback, even if subscription requests are pending, and the connection is
  // still open.
  if(this.callback) {
    this.callback();
  }
}

function exp(title, fileName) {
  const context = {
    'title': title || 'Subscriptions',
    'fileName': fileName || 'subscriptions.xml',
    'feeds': [],
    'connection': null
  };

  openIndexedDB(expOnOpenDatabase.bind(this));
}

function expOnOpenDatabase(connection) {
  if(connection) {
    this.connection = connection;
    const transaction = connection.transaction('feed');
    const store = transaction.objectStore('feed');
    const request = store.openCursor();
    request.onsuccess = expOpenCursorOnSuccess.bind(this);
    request.onerror = expOpenCursorOnError.bind(this);
  } else {
    console.error('Connection error');
  }
}

function expOpenCursorOnError(event) {
  console.error(event.target.error);
  if(this.connection) {
    this.connection.close();
  }
}

function expOpenCursorOnSuccess(event) {
  const cursor = event.target.result;
  if(cursor) {
    // Deserialize each object into a Feed object
    const feed = new Feed(cursor.value);
    this.feeds.push(feed);
    cursor.continue();
  } else {
    this.connection.close();
    expOnGetFeeds.call(this);
  }
}

function expOnGetFeeds() {
  // Create an OPML document template
  const doc = createOPMLDocument(this.title);

  // Map the feed objects into outline elements
  const outlines = this.feeds.map(createOutlineFromFeed.bind(null, doc));

  // Get the body element of the template
  // Assume this always works because it is coming from the template we
  // created which we know has a body.
  // This uses querySelector instead of doc.body due because for an unknown
  // reason doc.body yields undefined.
  const body = doc.querySelector('body');

  // Append the outlines to the body
  for(let outline of outlines) {
    body.appendChild(outline);
  }

  // Create a blob anchor
  const writer = new XMLSerializer();
  const opmlString = writer.serializeToString(doc);
  const blob = new Blob([opmlString], {'type': 'application/xml'});
  const objectURL = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = objectURL;
  anchor.setAttribute('download', this.fileName);
  anchor.style.display = 'none';
  const parentElement = document.body || document.documentElement;
  parentElement.appendChild(anchor);

  // Trigger the download of the file
  anchor.click();

  // Cleanup
  URL.revokeObjectURL(objectURL);
  anchor.remove();

  console.log('Exported %s feeds to opml file %s', this.feeds.length,
    this.fileName);
}

function createOPMLDocument(title) {
  const doc = document.implementation.createDocument(null, 'opml', null);
  doc.documentElement.setAttribute('version', '2.0');

  const headElement = doc.createElement('head');
  doc.documentElement.appendChild(headElement);

  if(title) {
    const titleElement = doc.createElement('title');
    titleElement.textContent = title;
    headElement.appendChild(titleElement);
  }

  const nowDate = new Date();
  const nowUTCString = nowDate.toUTCString();

  const dateCreatedElement = doc.createElement('datecreated');
  dateCreatedElement.textContent = nowUTCString;
  headElement.appendChild(dateCreatedElement);

  const dateModifiedElement = doc.createElement('datemodified');
  dateModifiedElement.textContent = nowUTCString;
  headElement.appendChild(dateModifiedElement);

  const docsElement = doc.createElement('docs');
  docsElement.textContent = 'http://dev.opml.org/spec2.html';
  headElement.appendChild(docsElement);

  const bodyElement = doc.createElement('body');
  doc.documentElement.appendChild(bodyElement);

  return doc;
}

function createOutlineFromFeed(document, feed) {
  const outline = document.createElement('outline');

  if(feed.type) {
    outline.setAttribute('type', feed.type);
  }

  outline.setAttribute('xmlUrl', feed.getURL().toString());

  if(feed.title) {
    outline.setAttribute('text', feed.title);
    outline.setAttribute('title', feed.title);
  }

  if(feed.description) {
    outline.setAttribute('description', feed.description);
  }

  if(feed.link) {
    outline.setAttribute('htmlUrl', feed.link.toString());
  }

  return outline;
}

exports.opml = {};
exports.opml.importFiles = imp;
exports.opml.exportFile = exp;

}(this, openIndexedDB, Subscription, Feed));
