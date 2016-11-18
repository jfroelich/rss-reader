// See license.md

'use strict';

function export_opml(feeds = [], title = 'Subscriptions',
  file_name = 'subs.xml', log = SilentConsole) {
  log.log('Exporting %d feeds to file', feeds.length, file_name);

  // Create the opml document
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

  // Map feeds to outline elements and append them to the document
  for(let feed of feeds) {
    const outline = doc.createElement('outline');
    if(feed.type)
      outline.setAttribute('type', feed.type);
    const feed_url = Feed.getURL(feed);
    outline.setAttribute('xmlUrl', feed_url);
    if(feed.title) {
      outline.setAttribute('text', feed.title);
      outline.setAttribute('title', feed.title);
    }
    if(feed.description)
      outline.setAttribute('description', feed.description);
    if(feed.link)
      outline.setAttribute('htmlUrl', feed.link);
    log.debug('Appending outline', outline);
    body.appendChild(outline);
  }

  // Create an object url and trigger its download
  const writer = new XMLSerializer();
  const opml_str = writer.serializeToString(doc);
  const blob = new Blob([opml_str], {'type': 'application/xml'});
  const obj_url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = obj_url;
  anchor.setAttribute('download', file_name);
  log.debug('Triggering file download');
  anchor.click();
  URL.revokeObjectURL(obj_url);
}
