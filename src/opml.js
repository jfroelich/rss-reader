// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

var rdr = rdr || {};
rdr.opml = {};
rdr.opml.export = {};
rdr.opml.import = {};

rdr.opml.parse = function(inputString) {
  if(!rdr.xml.parse) {
    throw new ReferenceError('missing dependency rdr.xml.parse');
  }

  const doc = rdr.xml.parse(inputString);

  if(!doc) {
    throw new Error('rdr.xml.parse did not yield a document');
  }

  const rootName = doc.documentElement.localName;
  if(rootName !== 'opml') {
    throw new Error('Invalid document element: ' + rootName);
  }
  return doc;
};

rdr.opml.createDoc = function(title) {
  const doc = document.implementation.createDocument(null, 'opml', null);
  doc.documentElement.setAttribute('version', '2.0');
  const head = doc.createElement('head');
  doc.documentElement.appendChild(head);
  if(title) {
    const titleEl = doc.createElement('title');
    titleEl.textContent = title;
    head.appendChild(titleEl);
  }
  const nowDate = new Date();
  const nowDateUTCString = nowDate.toUTCString();
  const dateCreated = doc.createElement('datecreated');
  dateCreated.textContent = nowDateUTCString;
  head.appendChild(dateCreated);
  const dateModified = doc.createElement('datemodified');
  dateModified.textContent = nowDateUTCString;
  head.appendChild(dateModified);
  const docs = doc.createElement('docs');
  docs.textContent = 'http://dev.opml.org/spec2.html';
  head.appendChild(docs);
  const body = doc.createElement('body');
  doc.documentElement.appendChild(body);
  return doc;
};

// Queries the database for feeds, creates an OPML file, and then triggers
// the download of the file.
// @param title {String} title tag value
// @param fileName {String} name of generated file
// @param versbose {boolean} if true, log progress to console
// @param callback {function} called on completion, no args
rdr.opml.export.start = function(title, fileName, verbose, callback) {
  if(this.verbose) {
    console.log('Starting opml export');
  }
  const context = {
    'callback': callback,
    'title': title || 'Subscriptions',
    'fileName': fileName || 'subscriptions.xml',
    'feeds': [],
    'db': null,
    'verbose': verbose
  };
  rdr.db.open(rdr.opml.export.onOpenDB.bind(context));
};

rdr.opml.export.onOpenDB = function(db) {
  if(!db) {
    rdr.opml.export.onComplete.call(this);
    return;
  }

  if(this.verbose) {
    console.debug('Connected to database');
  }

  this.db = db;
  rdr.feed.getAll(db, rdr.opml.export.onGetFeeds.bind(this));
};

rdr.opml.export.onGetFeeds = function(feeds) {
  this.feeds = feeds;

  if(this.verbose) {
    console.debug('Loaded %s feeds from database', this.feeds.length);
  }

  const doc = rdr.opml.createDoc(this.title);
  const outlines = [];
  for(let feed of this.feeds) {
    outlines.push(rdr.opml.export.createOutline(doc, feed));
  }

  // Append the outlines to the body
  // doc.body is sometimes undefined, not sure why
  const body = doc.querySelector('body');
  for(let outline of outlines) {
    body.appendChild(outline);
  }

  if(this.verbose) {
    console.dir(doc);
  }

  const writer = new XMLSerializer();
  const opmlString = writer.serializeToString(doc);
  const blob = new Blob([opmlString], {'type': 'application/xml'});
  const objectURL = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = objectURL;
  anchor.setAttribute('download', this.fileName);
  anchor.style.display = 'none';
  const parent = document.body || document.documentElement;
  parent.appendChild(anchor);
  anchor.click();
  URL.revokeObjectURL(objectURL);
  anchor.remove();
  rdr.opml.export.onComplete.call(this);
};

rdr.opml.export.onComplete = function() {
  if(this.db) {
    this.db.close();
  }
  if(this.verbose) {
    console.log('Exported %s feeds to %s', this.feeds.length, this.fileName);
  }

  if(this.callback) {
    this.callback();
  }
};

// Creates an outline element from an object representing a feed
rdr.opml.export.createOutline = function(doc, feed) {
  const outline = doc.createElement('outline');

  if(feed.type) {
    outline.setAttribute('type', feed.type);
  }

  const feedURL = rdr.feed.getURL(feed);

  if(!feedURL) {
    throw new Error('feed is missing url: ' + JSON.stringify(feed));
  }

  outline.setAttribute('xmlUrl', feedURL);

  if(feed.title) {
    outline.setAttribute('text', feed.title);
    outline.setAttribute('title', feed.title);
  }

  if(feed.description) {
    outline.setAttribute('description', feed.description);
  }

  if(feed.link) {
    outline.setAttribute('htmlUrl', feed.link);
  }

  return outline;
};

// Prompts for files to upload, then uploads files and imports outlines as feeds
// @param verbose {boolean} if true, log some actions to console
// @param callback {function} optional, called when process completes, is not
// passed any arguments
rdr.opml.import.start = function(verbose, callback) {
  if(verbose) {
    console.debug('Importing OPML files...');
  }

  const uploader = rdr.opml.import.createUploadElement();
  const context = {
    'numFilesProcessed': 0,
    'callback': callback,
    'uploader': uploader,
    'verbose': verbose,
    'files': null
  };

  uploader.onchange = rdr.opml.import.onUploaderChange.bind(context);
  uploader.click();
};

rdr.opml.import.createUploadElement = function() {
  const uploader = document.createElement('input');
  uploader.setAttribute('type', 'file');
  uploader.style.display = 'none';
  document.documentElement.appendChild(uploader);
  return uploader;
};

rdr.opml.import.onUploaderChange = function(event) {
  this.uploader.removeEventListener('change',
    rdr.opml.import.onUploaderChange);
  this.files = [...this.uploader.files];
  if(!this.files || !this.files.length) {
    rdr.opml.import.onComplete.call(this);
    return;
  }
  rdr.db.open(rdr.opml.import.onOpenDB.bind(this));
};

rdr.opml.import.onOpenDB = function(db) {
  const prefix = rdr.opml.import;

  if(!db) {
    if(this.verbose) {
      console.debug('Failed to connect to db');
    }
    prefix.onComplete.call(this);
    return;
  }

  this.db = db;
  this.files = prefix.filterNonXMLFiles(this.files);
  this.files = prefix.filterEmptyFiles(this.files);

  for(let file of this.files) {
    console.debug('Loading', file.name);
    const reader = new FileReader();
    reader.onload = prefix.readerOnLoad.bind(this, file);
    reader.onerror = prefix.readerOnError.bind(this, file);
    reader.readAsText(file);
  }
};

rdr.opml.import.filterNonXMLFiles = function(files) {
  const output = [];
  for(let file of files) {
    if(!file.type) {
      throw new Error('file has no type');
    }

    if(file.type.toLowerCase().includes('xml')) {
      output.push(file);
    }
  }
  return output;
};

rdr.opml.import.filterEmptyFiles = function(files) {
  const output = [];
  for(let file of files) {
    if(file.size > 0) {
      output.push(file);
    }
  }
  return output;
};

rdr.opml.import.readerOnError = function(file, event) {
  console.warn(file.name, event.target.error);
  rdr.opml.import.onFileProcessed.call(this, file);
};

rdr.opml.import.readerOnLoad = function(file, event) {
  const prefix = rdr.opml.import;

  if(this.verbose) {
    console.debug('Loaded', file.name);
  }

  const text = event.target.result;
  let doc;
  try {
    doc = rdr.opml.parse(text);
  } catch(error) {
    if(this.verbose) {
      console.warn(file.name, error);
    }
    prefix.onFileProcessed.call(this, file);
    return;
  }

  const outlineElements = prefix.selectOutlineElements(doc);
  let outlines = outlineElements.map(prefix.createOutlineObject);
  outlines = outlines.filter(prefix.outlineHasValidType);
  outlines = outlines.filter(prefix.outlineHasURL);
  outlines.forEach(prefix.deserializeOutlineURL);
  outlines = outlines.filter(prefix.outlineHasURLObject);

  // Reduce constraint work
  outlines = prefix.filterDuplicateOutlines(outlines);

  const feeds = outlines.map(prefix.createFeedFromOutline);
  const subOptions = {
    'connection': this.db,
    'suppressNotifications': true
  };

  for(let feed of feeds) {
    rdr.feed.subscribe.start(feed, subOptions);
  }

  prefix.onFileProcessed.call(this, file);
};

rdr.opml.import.onFileProcessed = function(file) {
  if(this.verbose) {
    console.debug('Processed file "', file.name, '"');
  }

  this.numFilesProcessed++;
  // Compare against this.files, not uploader.files, because we have filtered
  // out some files before processing
  if(this.numFilesProcessed === this.files.length) {
    rdr.opml.import.onComplete.call(this);
  }
};

rdr.opml.import.onComplete = function() {
  if(this.verbose) {
    console.log('Completed opml file import');
  }

  if(this.uploader) {
    this.uploader.remove();
  }

  if(this.db) {
    this.db.close();
  }

  if(this.callback) {
    this.callback();
  }
};



// Scans the opml document for outline elements
rdr.opml.import.selectOutlineElements = function(doc) {
  const outlines = [];

  // This is using querySelector because doc.body is undefined, not sure why.
  const body = doc.querySelector('body');
  if(!body) {
    return outlines;
  }

  // Look at immediate children
  for(let el = body.firstElementChild; el; el = el.nextElementSibling) {
    if(el.localName === 'outline') {
      outlines.append(el);
    }
  }
  return outlines;
};

rdr.opml.import.createOutlineObject = function(element) {
  if(!element) {
    throw new TypeError('element param must be an element');
  }

  if(element.localName !== 'outline') {
    throw new TypeError('element is not an outline: ' + element.outerHTML);
  }

  return {
    'description': outline.getAttribute('description'),
    'link': outline.getAttribute('htmlUrl'),
    'text': outline.getAttribute('text'),
    'title': outline.getAttribute('title'),
    'type': outline.getAttribute('type'),
    'url': outline.getAttribute('xmlUrl')
  };
};

// The length check reduce the regex calls
rdr.opml.import.outlineHasValidType = function(outline) {
  const type = outline.type;
  return type && type.length > 2 && /rss|rdf|feed/i.test(type);
};

rdr.opml.import.outlineHasURL = function(outline) {
  return outline.url && outline.url.trim();
};

rdr.opml.import.deserializeOutlineURL = function(outline) {
  try {
    outline.urlObject = new URL(outline.url);
    outline.urlObject.hash = '';
  } catch(error) {
  }
};

rdr.opml.import.outlineHasURLObject = function(outline) {
  return 'urlObject' in outline;
};

// Using includes because of small size
rdr.opml.import.filterDuplicateOutlines = function(inputOutlines) {
  const outputOutlines = [];
  for(let outline of inputOutlines) {
    const urlString = outline.urlObject.href;
    if(!outputOutlines.includes(urlString)) {
      outputOutlines.push(outline);
    }
  }

  return outputOutlines;
};

rdr.opml.import.createFeedFromOutline = function(outline) {
  const feed = {};
  rdr.feed.addURL(feed, outline.urlObject.href);
  feed.type = outline.type;
  feed.title = outline.title || outline.text;
  feed.description = outline.description;
  if(outline.link) {
    try {
      const linkURL = new URL(outline.link);
      linkURL.hash = '';
      feed.link = linkURL.href;
    } catch(error) {
    }
  }
  return feed;
};
