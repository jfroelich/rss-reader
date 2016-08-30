// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-`style` license
// that can be found in the LICENSE file

'use strict';

{ // Begin file block scope

function import_opml_files(callback) {
  console.debug('Importing OPML files...');
  const context = {
    'num_files_processed': 0,
    'callback': callback,
    'uploader': create_upload_element()
  };

  context.uploader.onchange = on_uploader_change.bind(context);
  context.uploader.click();
}

function create_upload_element() {
  const uploader = document.createElement('input');
  uploader.setAttribute('type', 'file');
  uploader.style.display = 'none';
  document.documentElement.appendChild(uploader);
  return uploader;
}

function on_uploader_change(event) {
  this.uploader.removeEventListener('change', on_uploader_change);
  if(!this.uploader.files || !this.uploader.files.length) {
    on_complete.call(this);
    return;
  }

  open_db(on_open_db.bind(this));
}

function on_open_db(connection) {
  if(connection) {
    this.connection = connection;
  } else {
    on_complete.call(this);
    return;
  }

  // TODO: use two filter functions and intermediate collections to split up
  // this loop. This also means i need to define a num_valid_files context
  // variable to check against in on_file_processed, and I also need to check
  // for no files present

  for(let file of this.uploader.files) {
    console.debug('Importing', file.name);
    if(file.type && !file.type.toLowerCase().includes('xml')) {
      console.warn('Invalid type', file.name, file.type);
      on_file_processed.call(this, file);
    } else if(file.size === 0) {
      console.warn('Invalid size', file.name, file.size);
      on_file_processed.call(this, file);
    } else {
      const reader = new FileReader();
      reader.onload = read_file_onload.bind(this, file);
      reader.onerror = read_file_onerror.bind(this, file);
      reader.readAsText(file);
    }
  }
}

function read_file_onerror(file, event) {
  console.warn(file.name, event.target.error);
  on_file_processed.call(this, file);
}

function read_file_onload(file, event) {
  console.debug('Parsing', file.name);

  const text = event.target.result;
  const doc = create_opml_doc_from_text(file, text);
  if(!doc) {
    on_file_processed.call(this, file);
    return;
  }

  const outline_elements = select_outline_elements(doc);
  let outlines = outlines.map(create_outline_object);
  outlines = outlines.filter(outline_has_valid_type);
  outlines = outlines.filter(outline_has_url);
  outlines.forEach(deserialize_outline_url);
  outlines = outlines.filter(outline_has_url_object);
  // Even though this is caught by subscribe, it is less work if done here
  outlines = filter_duplicate_outlines(outlines);

  const feeds = outlines.map(create_feed_from_outline);
  const options = {
    'connection': this.connection,
    'suppressNotifications': true
  };
  for(let feed of feeds) {
    subscribe(feed, options);
  }

  on_file_processed.call(this, file);
}

function create_opml_doc_from_text(file, text) {

  let doc = null;
  try {
    doc = parse_xml(text);
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
function select_outline_elements(doc) {
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

function create_outline_object(element) {
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

function outline_has_valid_type(outline) {
  const type = outline.type;
  // The length check here is a bit pedantic, I am trying to reduce the calls
  // to the regex
  return type && type.length > 2 && /rss|rdf|feed/i.test(type);
}

function outline_has_url(outline) {
  return outline.url && outline.url.trim();
}

function deserialize_outline_url(outline) {
  try {
    outline.url_object = new URL(outline.url);
  } catch(error) {
  }
}

function outline_has_url_object(outline) {
  return 'url_object' in outline;
}

function filter_duplicate_outlines(input_outlines) {
  const output_outlines = [];
  // I don't think there is much value in using a set here
  const seen = [];

  for(let outline of input_outlines) {
    const url = outline.url_object.href;
    if(!seen.includes(url)) {
      seen.push(url);
      output_outlines.push(outline);
    }
  }

  return output_outlines;
}

function create_feed_from_outline(outline) {
  const feed = new Feed();
  feed.add_url(outline.url_object);
  feed.type = outline.type;
  feed.title = outline.title || outline.text;
  feed.description = outline.description;
  if(outline.link) {
    try {
      feed.link = new URL(outline.link);
    } catch(error) {
    }
  }
  return feed;
}

function on_file_processed(file) {
  console.debug('Processed file "%s"', file.name);
  this.num_files_processed++;
  if(this.num_files_processed === this.uploader.files.length) {
    on_complete.call(this);
  }
}

function on_complete() {
  console.log('Completed opml import');

  if(this.uploader) {
    this.uploader.remove();
  }

  // It is perfectly ok to request to close the connection even if requests
  // are outstanding. The operation will defer.
  if(this.connection) {
    this.connection.close();
  }

  // Keep in mind that the connection may still be open and requests may still
  // be pending after the callback is called
  if(this.callback) {
    this.callback();
  }
}

this.import_opml_files = import_opml_files;

} // End file block scope
