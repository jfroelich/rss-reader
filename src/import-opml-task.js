// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

// TODO: rename to opml-import-task

function ImportOPMLTask() {
  this.parseXML = rdr.xml.parse;
  this.log = new LoggingService();
  this.openDBTask = new OpenFeedDbTask();
  this.subTask = new SubscribeTask();

  this.Feed = Feed;
}

ImportOPMLTask.prototype.parseFromString = function(str) {
  const doc = this.parseXML(str);
  // parse should have thrown an exception if there was a parsing error, and
  // otherwise guarantees it provides a document. Strongly assert again here
  // that document is defined
  if(!doc) {
    throw new Error('parse did not yield a document');
  }

  const rootName = doc.documentElement.localName;
  if(rootName !== 'opml') {
    throw new Error('Invalid document element: ' + rootName);
  }
  return doc;
};

// Prompts for files to upload, then uploads files and imports outlines as feeds
// @param callback {function} optional, called when process completes without
// arguments
ImportOPMLTask.prototype.start = function(callback) {
  this.log.log('Importing OPML files...');

  // Create the uploader in the context of the document containing this script
  const uploader = document.createElement('input');
  uploader.setAttribute('type', 'file');
  uploader.style.display = 'none';
  document.documentElement.appendChild(uploader);

  const ctx = {
    'numFilesProcessed': 0,
    'callback': callback,
    'uploader': uploader
    'files': null
  };
  uploader.onchange = this._onUploaderChange.bind(this, ctx);
  uploader.click();
};

ImportOPMLTask.prototype._onUploaderChange = function(ctx, event) {
  ctx.uploader.removeEventListener('change', this._onUploaderChange);
  // Treat uploader.files as readonly as a precaution
  ctx.files = [...ctx.uploader.files];
  if(!ctx.files || !ctx.files.length) {
    this._onComplete(ctx);
    return;
  }

  this.openDBTask.open(this._openDBOnSuccess.bind(this, ctx),
    this._openDBOnError.bind(this, ctx));
};

ImportOPMLTask.prototype._openDBOnSuccess = function(ctx, event) {
  ctx.db = event.target.result;
  ctx.files = this._filterNonXMLFiles(ctx.files);
  ctx.files = this._filterEmptyFiles(ctx.files);

  for(let file of ctx.files) {
    console.debug('Loading', file.name);
    const reader = new FileReader();
    reader.onload = this._readerOnLoad.bind(this, ctx, file);
    reader.onerror = this._readerOnError.bind(this, ctx, file);
    reader.readAsText(file);
  }
};

ImportOPMLTask.prototype._openDBOnError = function(ctx, event) {
  console.error(event.target.error);
  this._onComplete(ctx);
};

ImportOPMLTask.prototype._filterNonXMLFiles = function(files) {
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

ImportOPMLTask.prototype._filterEmptyFiles = function(files) {
  const output = [];
  for(let file of files) {
    if(file.size > 0) {
      output.push(file);
    }
  }
  return output;
};

ImportOPMLTask.prototype._readerOnLoad = function(ctx, file, event) {
  this.log.log('Loaded file', file.name);

  const text = event.target.result;
  let doc;
  try {
    doc = this.parseFromString(text);
  } catch(error) {
    this.log.warn(file.name, error);
    this._onFileProcessed(ctx, file);
    return;
  }

  const outlineElements = this._selectOutlineElements(doc);
  let outlines = outlineElements.map(this._createOutlineObject);
  outlines = outlines.filter(this.outlineHasValidType);
  outlines = outlines.filter(this.outlineHasURL);
  outlines.forEach(this.deserializeOutlineURL);
  outlines = outlines.filter(this.outlineHasURLObject);

  // It is probably faster to reduce the number of subscribe errors that will
  // occur here rather than during
  outlines = this.filterDuplicateOutlines(outlines);

  const feeds = outlines.map(this.createFeedFromOutline);
  const options = {
    'connection': this.db,
    'suppressNotifications': true
  };

  for(let feed of feeds) {
    this.subTask.start(feed, options);
  }

  this._onFileProcessed(ctx, file);
};

ImportOPMLTask.prototype._readerOnError = function(ctx, file, event) {
  console.warn(file.name, event.target.error);
  this._onFileProcessed(ctx, file);
};

ImportOPMLTask.prototype._onFileProcessed = function(ctx, file) {
  this.log.debug('Processed file "', file.name, '"');
  ctx.numFilesProcessed++;
  // Compare against this.files, not uploader.files, because we have filtered
  // out some files before processing
  if(ctx.numFilesProcessed === ctx.files.length) {
    this._onComplete(ctx);
  }
};

ImportOPMLTask.prototype._onComplete = function(ctx) {
  this.log.log('Completed opml import');
  if(ctx.uploader) {
    ctx.uploader.remove();
  }
  if(ctx.db) {
    ctx.db.close();
  }
  if(ctx.callback) {
    ctx.callback();
  }
};

// Scans the opml document for outline elements
ImportOPMLTask.prototype._selectOutlineElements = function(doc) {
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

ImportOPMLTask.prototype._createOutlineObject = function(element) {
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
ImportOPMLTask.prototype.outlineHasValidType = function(outline) {
  const type = outline.type;
  return type && type.length > 2 && /rss|rdf|feed/i.test(type);
};

ImportOPMLTask.prototype.outlineHasURL = function(outline) {
  return outline.url && outline.url.trim();
};

ImportOPMLTask.prototype.deserializeOutlineURL = function(outline) {
  try {
    outline.urlObject = new URL(outline.url);
    outline.urlObject.hash = '';
  } catch(error) {
  }
};

ImportOPMLTask.prototype.outlineHasURLObject = function(outline) {
  return 'urlObject' in outline;
};

// Using includes because of small size
ImportOPMLTask.prototype.filterDuplicateOutlines = function(inputOutlines) {
  const outputOutlines = [];
  for(let outline of inputOutlines) {
    const urlString = outline.urlObject.href;
    if(!outputOutlines.includes(urlString)) {
      outputOutlines.push(outline);
    }
  }

  return outputOutlines;
};

ImportOPMLTask.prototype.createFeedFromOutline = function(outline) {
  const feed = {};
  this.Feed.addURL(feed, outline.urlObject.href);
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
