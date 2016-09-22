// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-`style` license
// that can be found in the LICENSE file

'use strict';

// TODO: add verbose option

var rdr = rdr || {};
rdr.opml = rdr.opml || {};
rdr.opml.import = {};

// Prompts for files to upload, then uploads xml files and imports outlines
// from opml files as feeds into storage.
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
    'verbose': verbose
  };

  uploader.onchange = rdr.opml.import.onUploaderChange.bind(context);
  uploader.click();
};

// Create the uploader in the context of the document containing this script
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
  if(!this.uploader.files || !this.uploader.files.length) {
    rdr.opml.import.onComplete.call(this);
    return;
  }

  rdr.db.open(rdr.opml.import.onOpenDB.bind(this));
};

rdr.opml.import.onOpenDB = function(db) {
  const prefix = rdr.opml.import;
  if(db) {
    this.db = db;
  } else {
    if(this.verbose) {
      console.debug('Failed to connect to db');
    }
    prefix.onComplete.call(this);
    return;
  }

  // TODO: use two filter functions and intermediate collections to split up
  // this loop. This also means i need to define a numValidFiles context
  // variable to check against in rdr.opml.import.onFileProcessed, and I also need to check
  // for no files present

  // NOTE: it is important to do the filters before trying to load, because
  // this avoids the loading work. The type and size information are available
  // before loading occurs (I think).

  for(let file of this.uploader.files) {
    console.debug('Loading', file.name);
    if(file.type && !file.type.toLowerCase().includes('xml')) {
      if(this.verbose) {
        console.warn('Invalid type', file.name, file.type);
      }

      prefix.onFileProcessed.call(this, file);
    } else if(file.size === 0) {
      if(this.verbose) {
        console.warn('Empty file', file.name);
      }

      prefix.onFileProcessed.call(this, file);
    } else {
      const reader = new FileReader();
      reader.onload = prefix.fileReaderOnload.bind(this, file);
      reader.onerror = prefix.fileReaderOnerror.bind(this, file);
      reader.readAsText(file);
    }
  }
};

rdr.opml.import.fileReaderOnerror = function(file, event) {
  console.warn(file.name, event.target.error);
  rdr.opml.import.onFileProcessed.call(this, file);
};

rdr.opml.import.fileReaderOnload = function(file, event) {
  const prefix = rdr.opml.import;

  if(this.verbose) {
    console.debug('Loaded', file.name);
  }

  const text = event.target.result;
  const doc = prefix.parseOPML.call(this, file, text);
  if(!doc) {
    prefix.onFileProcessed.call(this, file);
    return;
  }

  const outlineElements = prefix.selectOutlineElements(doc);
  let outlines = outlineElements.map(prefix.createOutlineObject);
  outlines = outlines.filter(prefix.outlineHasValidType);
  outlines = outlines.filter(prefix.outlineHasURL);
  outlines.forEach(prefix.deserializeOutlineURL);
  outlines = outlines.filter(prefix.outlineHasURLObject);

  // Even though this is caught by subscribe, which calls out to rdr.feed.add,
  // which produces a ConstraintError on the urls index in the case of a
  // duplicate, it is less work if done here
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

rdr.opml.import.parseOPML = function(file, text) {
  let doc = null;
  const parse = rdr.xml.parse;
  try {
    doc = parse(text);
  } catch(error) {
    if(this.verbose) {
      console.warn(file.name, error);
    }

    return null;
  }

  if(doc.documentElement.localName !== 'opml') {
    if(this.verbose) {
      console.warn(file.name, doc.documentElement.nodeName, 'is not opml');
    }

    return null;
  }

  return doc;
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
  console.assert(element);
  console.assert(element.localName === 'outline');
  return {
    'description': outline.getAttribute('description'),
    'link': outline.getAttribute('htmlUrl'),
    'text': outline.getAttribute('text'),
    'title': outline.getAttribute('title'),
    'type': outline.getAttribute('type'),
    'url': outline.getAttribute('xmlUrl')
  };
};

// The length check here is a bit pedantic, I am trying to reduce the calls
// to the regex
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
    // Apply additional normalization
    outline.urlObject.hash = '';
  } catch(error) {
  }
};

rdr.opml.import.outlineHasURLObject = function(outline) {
  return 'urlObject' in outline;
};

// This uses includes to check instead of set membership because there are
// generally not enough outlines to merit using a set.
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

rdr.opml.import.onFileProcessed = function(file) {
  if(this.verbose) {
    console.debug('Processed file "', file.name, '"');
  }

  this.numFilesProcessed++;
  if(this.numFilesProcessed === this.uploader.files.length) {
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

  // Request the connection to close once pending requests complete.
  if(this.db) {
    this.db.close();
  }

  // Note that requests may still be pending.
  if(this.callback) {
    this.callback();
  }
};
