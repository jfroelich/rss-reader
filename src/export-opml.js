// See license.md

'use strict';

{

function export_opml(db, title, file_name, log, callback) {
  const ctx = {
    'callback': callback,
    'title': title || 'Subscriptions',
    'file_name': file_name || 'subs.xml',
    'log': log,
    'db': db
  };
  log.log('Exporting opml file', ctx.file_name);
  db.connect(connect_on_success.bind(ctx), connect_on_error.bind(ctx));
}

function connect_on_success(conn) {
  this.log.debug('Connected to database', this.db.name);
  db_get_all_feeds(this.log, conn, on_get_feeds.bind(this));
  conn.close();
}

function connect_on_error() {
  on_complete.call(this);
}

function on_get_feeds(feeds) {
  this.log.debug('Loaded %s feeds', feeds.length);
  const doc = create_opml_doc(this.title);
  const outlines = [];
  for(let feed of feeds) {
    const outline = create_outline(doc, feed);
    outlines.push(outline);
  }

  // unsure why doc.body is sometimes undefined
  const body = doc.querySelector('body');
  for(let outline of outlines) {
    body.appendChild(outline);
  }

  const writer = new XMLSerializer();
  const opml_str = writer.serializeToString(doc);
  const blob = new Blob([opml_str], {'type': 'application/xml'});
  const obj_url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = obj_url;
  anchor.setAttribute('download', this.file_name);
  anchor.style.display = 'none';
  const parent = document.body || document.documentElement;
  parent.appendChild(anchor);
  this.log.debug('Triggering download of opml file');
  anchor.click();
  URL.revokeObjectURL(obj_url);
  anchor.remove();
  on_complete.call(this);
}

function on_complete() {
  this.log.log('Completed export');
  if(this.callback)
    this.callback();
}

// Creates an outline element from an object representing a feed
function create_outline(doc, feed) {
  const outline = doc.createElement('outline');

  if(feed.type)
    outline.setAttribute('type', feed.type);

  const feed_url = get_feed_url(feed);
  if(!feed_url)
    throw new TypeError();

  outline.setAttribute('xmlUrl', feed_url);

  if(feed.title) {
    outline.setAttribute('text', feed.title);
    outline.setAttribute('title', feed.title);
  }

  if(feed.description)
    outline.setAttribute('description', feed.description);

  if(feed.link)
    outline.setAttribute('htmlUrl', feed.link);

  return outline;
}

function create_opml_doc(title) {
  const doc = document.implementation.createDocument(null, 'opml', null);
  doc.documentElement.setAttribute('version', '2.0');
  const head = doc.createElement('head');
  doc.documentElement.appendChild(head);
  if(title) {
    const title_el = doc.createElement('title');
    title_el.textContent = title;
    head.appendChild(title_el);
  }
  const current_date = new Date();
  const current_date_utc = current_date.toUTCString();
  const date_created_el = doc.createElement('datecreated');
  date_created_el.textContent = current_date_utc;
  head.appendChild(date_created_el);
  const date_modified_el = doc.createElement('datemodified');
  date_modified_el.textContent = current_date_utc;
  head.appendChild(date_modified_el);
  const docs = doc.createElement('docs');
  docs.textContent = 'http://dev.opml.org/spec2.html';
  head.appendChild(docs);
  const body = doc.createElement('body');
  doc.documentElement.appendChild(body);
  return doc;
}

this.export_opml = export_opml;

}
