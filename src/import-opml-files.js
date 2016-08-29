// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-`style` license
// that can be found in the LICENSE file

'use strict';

{ // Begin file block scope

this.import_opml_files = function(callback) {
  console.debug('Importing OPML files...');

  const context = {
    'num_files_processed': 0,
    'callback': callback,
    'uploader': create_upload_element()
  };

  context.uploader.onchange = on_uploader_change.bind(context);
  context.uploader.click();
};

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

  // Get and preprocess the outlines from the document

  // TODO: instead of using an array of outline elements, first create simple
  // objects containing all the relevant properties. Then work off of that.
  // Once this is done, I only need to convert url strings to URL objects once
  // in an earlier step, instead of again in each step.

  let outlines = select_outlines(doc);
  outlines = filter_non_feed_outlines(outlines);
  outlines = filter_outlines_without_urls(outlines);
  outlines = filter_outlines_with_invalid_urls(outlines);
  outlines = filter_duplicate_outlines(outlines);

  // Create feed objects from the outlines
  const feeds = outlines.map(create_feed_from_outline(outline));

  // This is invariant to the feed loop
  const sub_options = {
    'connection': this.connection,
    'suppressNotifications': true
  };

  // queue up sub requests
  for(let feed of feeds) {
    subscribe(feed, sub_options);
  }

  // Consider the file finished. subscription requests are pending
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
function select_outlines(doc) {
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

  // This walks explicitly because its too hard to restrict depth on
  // querySelectorAll and I want to be more strict.

  for(let el = body.firstElementChild; el; el = el.nextElementSibling) {
    if(el.localName === 'outline') {
      outlines.append(el);
    }
  }
  return outlines;
}

// Filters outlines that do not represent feeds according to the type
// attribute
function filter_non_feed_outlines(outlines) {

  // The length check here is a bit pedantic, I am trying to reduce the calls
  // to the regex

  return outlines.filter(function(outline) {
    const type = outline.getAttribute('type');
    return type && type.length > 2 && /rss|rdf|feed/i.test(type);
  });
}

function filter_outlines_without_urls(outlines) {
  return outlines.filter(function(outline) {
    const url = outline.getAttribute('xmlUrl');
    return url && url.trim();
  });
}

function filter_outlines_with_invalid_urls(outlines) {
  return outlines.filter(function(outline) {
    try {
      new URL(outline.getAttribute('xmlUrl'));
      return true;
    } catch(error) {}
    return false;
  });
}

function filter_duplicate_outlines(input_outlines) {

  const output_outlines = [];
  const seen = new Set();

  // TODO: i could probably still use filter here with a closure

  // NOTE: this uses url objects because accessing url.href normalizes the
  // url for us, and i want to compare the normalized versions of urls

  for(let outline of input_outlines) {
    // Never throws because caller checked validity in prior function
    const url = new URL(outline.getAttribute('xmlUrl'));

    // If we haven't seen it yet, add it to the set and the output
    if(!seen.has(url.href)) {
      seen.add(url.href);
      output.push(outline);
    }
  }

  return output_outlines;
}

function create_feed_from_outline(outline) {
  // Create a Feed object
  const feed = new Feed();

  // Never throws because checked in prior call
  const xml_url = new URL(outline.getAttribute('xmlUrl'));
  feed.add_url(xml_url);

  feed.type = outline.getAttribute('type');

  feed.title = outline.getAttribute('title');
  if(!feed.title) {
    feed.title = outline.getAttribute('text');
  }

  feed.description = outline.getAttribute('description');

  const html_url_string = outline.getAttribute('htmlUrl');
  if(html_url_string) {
    try {
      feed.link = new URL(html_url_string);
    } catch(error) {
    }
  }

  return feed;
}

function on_file_processed(file) {
  console.debug('Processed file "%s"', file.name);

  // This can only be incremented here because this function is called either
  // synchronously or asynchronously
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

} // End file block scope
