// See license.md

'use strict';

// TODO: return a promise
// TODO: use async

{

function import_opml(db_target, log = SilentConsole, callback) {
  if(!parse_xml)
    throw new ReferenceError();

  log.log('Starting opml import');

  // Create the uploader in the context of the document
  // containing this script
  const uploader = document.createElement('input');
  uploader.setAttribute('type', 'file');
  uploader.setAttribute('accept', 'application/xml');
  uploader.style.display = 'none';
  document.documentElement.appendChild(uploader);

  const ctx = {
    'num_files_processed': 0,
    'callback': callback,
    'uploader': uploader,
    'files': null,
    'log': log,
    'feed_db_target': db_target,
    'feed_db_conn': null,
    'icon_cache_conn': null,
    'icon_cache': new FaviconCache(log)
  };
  uploader.onchange = uploader_on_change.bind(ctx);
  uploader.click();
  log.debug('Clicked uploader');
}

function parse_opml(str) {
  const doc = parse_xml(str);
  if(!doc)
    throw new Error('parse_xml did not yield a document');
  const root_name = doc.documentElement.localName;
  if(root_name !== 'opml')
    throw new Error('Invalid document element: ' + root_name);
  return doc;
}

function uploader_on_change(event) {
  this.uploader.removeEventListener('change', uploader_on_change);

  this.files = [...this.uploader.files];
  this.files = filter_non_xml_files(this.files);
  this.files = filter_empty_files(this.files);
  if(!this.files.length) {
    on_complete.call(this);
    return;
  }

  db_connect(feed_db_target, this.log).then(
    feed_db_connect_on_success.bind(this)).catch(
      on_complete.bind(this));
}

function feed_db_connect_on_success(conn) {
  this.log.debug('Connected to database', this.feed_db.name);
  this.feed_db_conn = conn;
  this.icon_cache.connect(icon_db_connect_on_success.bind(this),
    icon_db_connect_on_error.bind(this));
}

function icon_db_connect_on_success(event) {
  this.log.debug('Connected to database', this.icon_cache.name);
  this.icon_cache_conn = event.target.result;
  for(let file of this.files) {
    this.log.debug('Loading file', file.name);
    const reader = new FileReader();
    reader.onload = reader_on_load.bind(this, file);
    reader.onerror = reader_on_error.bind(this, file);
    reader.readAsText(file);
  }
}

function icon_db_connect_on_error(event) {
  this.log.error(event.target.error);
  on_complete.call(this);
}

function filter_non_xml_files(files) {
  const output = [];
  for(let file of files) {
    if(file.type.toLowerCase().includes('xml'))
      output.push(file);
  }
  return output;
}

function filter_empty_files(files) {
  const output = [];
  for(let file of files) {
    if(file.size > 0)
      output.push(file);
  }
  return output;
}

function reader_on_load(file, event) {
  this.log.log('Loaded file', file.name);

  const text = event.target.result;
  let doc = null;
  try {
    doc = parse_opml(text);
  } catch(error) {
    this.log.warn(file.name, error);
    on_file_processed.call(this, file);
    return;
  }

  const outline_els = select_outline_elements(doc);
  let outlines = outline_els.map(create_outline_obj);
  outlines = outlines.filter(outline_has_valid_type);
  outlines = outlines.filter(outline_has_url);
  outlines.forEach(deserialize_outline_url);
  outlines = outlines.filter(outline_has_url_obj);
  outlines = filter_dup_outlines(outlines);
  const feeds = outlines.map(outline_to_feed);
  const suppress_notifs = true;
  const on_subscribe_callback = null;
  for(let feed of feeds) {
    subscribe(this.feed_db_conn, this.icon_cache_conn, feed, suppress_notifs,
      this.log, on_subscribe_callback);
  }

  on_file_processed.call(this, file);
}

function reader_on_error(file, event) {
  this.log.warn(file.name, event.target.error);
  on_file_processed.call(this, file);
}

function on_file_processed(file) {
  this.log.debug('Processed file "', file.name, '"');
  this.num_files_processed++;
  if(this.num_files_processed === this.files.length)
    on_complete.call(this);
}

function on_complete(error) {
  this.log.log('Completed opml import');
  if(this.uploader)
    this.uploader.remove();
  if(this.feed_db_conn) {
    this.log.debug('Closing feed cache database connection');
    this.feed_db_conn.close();
  }
  if(this.icon_cache_conn) {
    this.log.debug('Closing icon cache database connection');
    this.icon_cache_conn.close();
  }
  if(this.callback)
    this.callback();
}

function select_outline_elements(doc) {
  const outlines = [];
  // doc.body is undefined, not sure why
  const body = doc.querySelector('body');
  if(!body)
    return outlines;
  for(let el = body.firstElementChild; el; el = el.nextElementSibling) {
    if(el.localName === 'outline')
      outlines.append(el);
  }
  return outlines;
}

function create_outline_obj(element) {
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
  return type && type.length > 2 && /rss|rdf|feed/i.test(type);
}

function outline_has_url(outline) {
  return outline.url && outline.url.trim();
}

function deserialize_outline_url(outline) {
  try {
    outline.url_obj = new URL(outline.url);
    outline.url_obj.hash = '';
  } catch(error) {
  }
}

function outline_has_url_obj(outline) {
  return 'url_obj' in outline;
}

function filter_dup_outlines(outlines) {
  const output = [];
  for(let outline of outlines) {
    if(!output.includes(outline.url_obj.href))
      output.push(outline);
  }
  return output;
}

function outline_to_feed(outline) {
  const feed = {};
  add_feed_url(feed, outline.url_obj.href);
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

this.import_opml = import_opml;

}
