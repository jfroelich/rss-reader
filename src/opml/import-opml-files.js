// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-`style` license
// that can be found in the LICENSE file

'use strict';

{ // Begin file block scope

function importOPMLFiles(callback) {
  console.debug('Importing OPML files...');
  const uploader = createUploadElement();
  const context = {
    'numFilesProcessed': 0,
    'callback': callback,
    'uploader': uploader
  };

  uploader.onchange = onUploaderChange.bind(context);
  uploader.click();
}

function createUploadElement() {
  const uploader = document.createElement('input');
  uploader.setAttribute('type', 'file');
  uploader.style.display = 'none';
  document.documentElement.appendChild(uploader);
  return uploader;
}

function onUploaderChange(event) {
  this.uploader.removeEventListener('change', onUploaderChange);
  if(!this.uploader.files || !this.uploader.files.length) {
    onComplete.call(this);
    return;
  }

  openDB(onOpenDB.bind(this));
}

function onOpenDB(db) {
  if(db) {
    this.db = db;
  } else {
    onComplete.call(this);
    return;
  }

  // TODO: use two filter functions and intermediate collections to split up
  // this loop. This also means i need to define a num_valid_files context
  // variable to check against in onFileProcessed, and I also need to check
  // for no files present

  for(let file of this.uploader.files) {
    console.debug('Importing', file.name);
    if(file.type && !file.type.toLowerCase().includes('xml')) {
      console.warn('Invalid type', file.name, file.type);
      onFileProcessed.call(this, file);
    } else if(file.size === 0) {
      console.warn('Invalid size', file.name, file.size);
      onFileProcessed.call(this, file);
    } else {
      const reader = new FileReader();
      reader.onload = fileReaderOnload.bind(this, file);
      reader.onerror = fileReaderOnerror.bind(this, file);
      reader.readAsText(file);
    }
  }
}

function fileReaderOnerror(file, event) {
  console.warn(file.name, event.target.error);
  onFileProcessed.call(this, file);
}

function fileReaderOnload(file, event) {
  console.debug('Parsing', file.name);

  const text = event.target.result;
  const doc = createOPMLDocFromText(file, text);
  if(!doc) {
    onFileProcessed.call(this, file);
    return;
  }

  const outlineElements = selectOutlineElements(doc);
  let outlines = outlineElements.map(createOutlineObject);
  outlines = outlines.filter(outlineHasValidType);
  outlines = outlines.filter(outlineHasURL);
  outlines.forEach(deserializeOutlineURL);
  outlines = outlines.filter(outlineHasURLObject);
  // Even though this is caught by subscribe, it is less work if done here
  outlines = filterDuplicateOutlines(outlines);

  const feeds = outlines.map(createFeedFromOutline);
  const options = {
    'connection': this.db,
    'suppressNotifications': true
  };
  for(let feed of feeds) {
    subscribe(feed, options);
  }

  onFileProcessed.call(this, file);
}

function createOPMLDocFromText(file, text) {

  let doc = null;
  try {
    doc = parseXML(text);
  } catch(error) {
    console.warn(file.name, error);
    return null;
  }

  if(doc.documentElement.localName !== 'opml') {
    console.warn(file.name, doc.documentElement.nodeName, 'is not opml');
    return null;
  }

  return doc;
}

// Scans the opml document for outline elements
function selectOutlineElements(doc) {
  const outlines = [];

  // Unsure why accessing document.body yields undefined. I believe this is
  // because doc is xml-flagged and something funky is at work. I am trying to
  // mirror the browser implementation of document.body here, which is the first
  // body in document order.
  // Technically should be looking at only the immediate children of the
  // document element. For now I am being loose in this step.
  //
  // OPML documents are not required to have a body. This isn't an error,
  // this just means that there are no outlines to consider.
  const body = doc.querySelector('body');
  if(!body) {
    return outlines;
  }

  // This is more strict than querySelectorAll
  for(let el = body.firstElementChild; el; el = el.nextElementSibling) {
    if(el.localName === 'outline') {
      outlines.append(el);
    }
  }
  return outlines;
}

function createOutlineObject(element) {
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
}

function outlineHasValidType(outline) {
  const type = outline.type;
  // The length check here is a bit pedantic, I am trying to reduce the calls
  // to the regex
  return type && type.length > 2 && /rss|rdf|feed/i.test(type);
}

function outlineHasURL(outline) {
  return outline.url && outline.url.trim();
}

function deserializeOutlineURL(outline) {
  try {
    outline.urlObject = new URL(outline.url);
  } catch(error) {
  }
}

function outlineHasURLObject(outline) {
  return 'urlObject' in outline;
}

function filterDuplicateOutlines(inputOutlines) {
  const outputOutlines = [];
  // I don't think there is much value in using a set here
  const seen = [];

  for(let outline of inputOutlines) {
    const urlString = outline.urlObject.href;
    if(!seen.includes(urlString)) {
      seen.push(urlString);
      outputOutlines.push(outline);
    }
  }

  return outputOutlines;
}

function createFeedFromOutline(outline) {
  const feed = {};

  outline.urlObject.hash = '';

  appendFeedURL(feed, outline.urlObject.href);
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
}

function onFileProcessed(file) {
  console.debug('Processed file "%s"', file.name);
  this.numFilesProcessed++;
  if(this.numFilesProcessed === this.uploader.files.length) {
    onComplete.call(this);
  }
}

function onComplete() {
  console.log('Completed opml import');

  if(this.uploader) {
    this.uploader.remove();
  }

  // It is perfectly ok to request to close the connection even if requests
  // are outstanding. The operation will defer.
  if(this.db) {
    this.db.close();
  }

  // Keep in mind that the connection may still be open and requests may still
  // be pending after the callback is called
  if(this.callback) {
    this.callback();
  }
}

this.importOPMLFiles = importOPMLFiles;

} // End file block scope
