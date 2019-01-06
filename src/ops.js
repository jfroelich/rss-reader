import {fetch_feed} from '/src/net/fetch-feed/fetch-feed.js';
import * as db from '/src/db/db.js';
import {response_is_redirect} from '/src/net/fetch2.js';
import * as favicon from '/src/favicon/favicon-control.js';
import * as notification from '/src/note.js';

// The ops module represents a middle-layer that is above the database but
// below the view layer. The operations here generally are functions that
// involve the database plus some non-database functionality, such as any
// logic.

// TODO: all higher layers should be interacting with this module instead of
// interacting with the database. This should have all the various ops
// available, even if some of those are just simple db wrapper calls.



export async function export_opml(document_title) {
  // Load feeds from storage
  const session = await db.open();
  const feeds = await db.get_feeds(session, 'all', false);
  session.close();

  // Map feeds into outlines
  const outlines = [];
  for (const feed of feeds) {
    const outline = {};
    outline.type = feed.type;

    if (feed.urls && feed.urls.length) {
      outline.xml_url = feed.urls[feed.urls.length - 1];
    }

    outline.title = feed.title;
    outline.description = feed.description;
    outline.html_url = feed.link;
    outlines.push(outline);
  }

  // Create an opml document
  const opml_document = create_opml_template(document_title);

  // A local helper function. There is no perf issue because of how rarely
  // export is invoked.
  function set_attr_if_defined(element, name, value) {
    if (value) {
      element.setAttribute(name, value);
    }
  }

  // Append the outlines to the document. This uses querySelector instead of
  // document.body because that shortcut is not available for xml-flagged
  // documents. This creates elements using the xml document instead of the
  // document running this script so as to minimize the risk of XSS and to avoid
  // having the xml document adopt html elements.
  const body_element = opml_document.querySelector('body');
  for (const outline of outlines) {
    const elm = opml_document.createElement('outline');
    set_attr_if_defined(elm, 'type', outline.type);
    set_attr_if_defined(elm, 'xmlUrl', outline.xml_url);
    set_attr_if_defined(elm, 'title', outline.title);
    set_attr_if_defined(elm, 'description', outline.description);
    set_attr_if_defined(elm, 'htmlUrl', outline.html_url);
    body_element.appendChild(elm);
  }

  return opml_document;
}

function create_opml_template(document_title) {
  const doc = document.implementation.createDocument(null, 'opml', null);
  doc.documentElement.setAttribute('version', '2.0');

  const head_element = doc.createElement('head');
  doc.documentElement.appendChild(head_element);

  if (document_title) {
    const title_element = doc.createElement('title');
    title_element.textContent = document_title;
  }

  const current_date = new Date();
  const current_date_utc_string = current_date.toUTCString();

  const date_created_element = doc.createElement('datecreated');
  date_created_element.textContent = current_date_utc_string;
  head_element.appendChild(date_created_element);

  const date_modified_element = doc.createElement('datemodified');
  date_modified_element.textContent = current_date_utc_string;
  head_element.appendChild(date_modified_element);

  const docs_element = doc.createElement('docs');
  docs_element.textContent = 'http://dev.opml.org/spec2.html';
  head_element.appendChild(docs_element);

  const body_element = doc.createElement('body');
  doc.documentElement.appendChild(body_element);
  return doc;
}

export async function subscribe(session, iconn, url, fetch_timeout,
  should_notify) {

  // Check if subscribed to the input url
  let existing_feed = await db.get_feed(session, 'url', url, true);
  if (existing_feed) {
    const message = 'Found existing feed with url ' + url.href;
    throw new ConstraintError(message);
  }

  // TODO: notice the awkwardness here with response vs http response. I think
  // fetch_feed might be a bad abstraction. I think maybe what should happen
  // is that fetch_feed be broken up into consistuent parts fetch_xml and
  // parse_feed_from_xml

  // Propagate fetch errors as subscribe errors
  const response = await fetch_feed(url, timeout, true, false);
  const http_response = response.http_response;

  // If redirected, check if subscribed to the redirected url
  if(response_is_redirect(url, http_response)) {
    const rurl = new URL(http_response.url);
    let existing_feed = await db.get_feed(session, 'url', rurl, true);
    if (existing_feed) {
      const message = 'Found existing feed with redirect url ' + rurl.href;
      throw new ConstraintError(message);
    }
  }

  const feed = response.feed;
  await set_feed_favicon(iconn, feed);
  db.validate_feed(feed);
  db.sanitize_feed(feed);
  feed.id = await db.create_feed(session, feed);

  if(should_notify) {
    const feed_title = feed.title || feed.urls[feed.urls.length - 1];
    const note = {};
    note.title = 'Subscribed!';
    note.message = 'Subscribed to ' + feed_title;
    note.url = feed.faviconURLString;
    notification.show(note);
  }

  return feed;
}

export function unsubscribe(session, feed_id) {
  return db.delete_feed(session, feed_id, 'unsubscribe');
}

async function set_feed_favicon(iconn, feed) {
  if (!iconn) {
    return;
  }

  const lookup_url = favicon.create_lookup_url(feed);
  let prefetched_document = undefined;
  const do_fetch_during_lookup = false;
  feed.faviconURLString = await favicon.lookup(
      iconn, lookup_url, prefetched_document, do_fetch_during_lookup);
}


export async function refresh_feed_icons(session, iconn) {
  const feeds = await db.get_feeds(session, 'active', false);
  const promises = [];
  for (const feed of feeds) {
    promises.push(refresh_feed_icon(session, iconn, feed));
  }
  return Promise.all(promises);
}

// Update the favicon of a feed in the database
async function refresh_feed_icon(session, iconn, feed) {
  if (!feed.urls || !feed.urls.length) {
    return;
  }

  const lookup_url = favicon.create_lookup_url(feed);
  if (!lookup_url) {
    return;
  }

  let doc = undefined;
  let fetch_flag = true;
  const icon_url_string =
      await favicon.lookup(iconn, lookup_url, doc, fetch_flag);

  if (feed.faviconURLString !== icon_url_string) {
    if (icon_url_string) {
      feed.faviconURLString = icon_url_string;
    } else {
      delete feed.faviconURLString;
    }

    // TODO: use a partial update here instead of a full feed overwrite
    await db.update_feed(session, feed, true);
  }
}

export class ConstraintError extends Error {
  constructor(message = 'Violation of storage constraint') {
    super(message);
  }
}
