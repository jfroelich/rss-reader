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
    'uploader': null
  };

  // Prompt for file upload
  const uploader = document.createElement('input');
  context.uploader = uploader;
  uploader.setAttribute('type', 'file');
  uploader.style.display = 'none';
  uploader.onchange = on_uploader_change.bind(context);
  const parentElement = document.body || document.documentElement;
  parentElement.appendChild(uploader);
  uploader.click();
};

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
  const parser = new DOMParser();
  const file_text = event.target.result;
  let document = null;
  try {
    document = parser.parseFromString(file_text, 'application/xml');
  } catch(error) {
    console.warn(file.name, error);
    on_file_processed.call(this, file);
    return;
  }

  if(!document) {
    console.warn(file.name, 'has undefined document');
    on_file_processed.call(this, file);
    return;
  }

  const parser_error = document.querySelector('parsererror');
  if(parser_error) {
    console.warn(file.name, parser_error.textContent);
    on_file_processed.call(this, file);
    return;
  }

  if(document.documentElement.localName !== 'opml') {
    console.warn(file.name, document.documentElement.nodeName, 'is not opml');
    on_file_processed.call(this, file);
    return;
  }

  // Unsure why accessing document.body yields undefined
  const body = document.querySelector('body');
  if(!body) {
    console.warn(file.name, 'is missing a body');
    on_file_processed.call(this, file);
    return;
  }

  // Add each of the outlines representing feeds in the body
  const seen_urls = new Set();
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
    const url_string = (element.getAttribute('xmlUrl') || '').trim();
    if(!url_string) {
      console.warn('Outline missing url', element.outerHTML);
      continue;
    }

    // Skip outlines without a valid url
    let url = null;
    try {
      url = new URL(url_string);
    } catch(error) {
      console.warn('Invalid url', element.outerHTML);
      continue;
    }

    // Skip duplicate outlines (compared by normalized url)
    if(seen_urls.has(url.href)) {
      console.debug('Duplicate', element.outerHTML);
      continue;
    }
    seen_urls.add(url.href);

    // Create a Feed object
    const feed = new Feed();
    feed.add_url(url);
    feed.type = type;
    feed.title = element.getAttribute('title');
    if(!feed.title) {
      feed.title = element.getAttribute('text');
    }
    feed.description = element.getAttribute('description');

    const html_url_string = element.getAttribute('htmlUrl');
    if(html_url_string) {
      try {
        feed.link = new URL(html_url_string);
      } catch(error) {
        console.warn(error);
      }
    }

    // Async, do not wait for the subscription request to complete
    subscribe(feed, {
      'connection': this.connection,
      'suppressNotifications': true
    });
  }

  // Consider the file finished. subscription requests are pending
  on_file_processed.call(this, file);
}

function on_file_processed(file) {
  console.debug('Finished processing', file.name);

  // This can only be incremented here because this function is called either
  // synchronously or asynchronously
  this.num_files_processed++;

  if(this.num_files_processed === this.uploader.files.length) {
    on_complete.call(this);
  }
}

function on_complete() {
  console.log('Completed import');

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
