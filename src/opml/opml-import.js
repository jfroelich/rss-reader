// Dependencies:
// file.js
// reader-db.js
// favicon.js
// feed.js
// opml-parser.js
// opml-document.js
// subscribe.js

(function(exports) {
'use strict';

async function import_opml_files(files, verbose) {
  if(verbose)
    console.log('Importing %d OPML XML files', files.length);

  let reader_conn, icon_conn, import_resolutions;
  try {
    const conns = await open_dbs();
    reader_conn = conns[0];
    icon_conn = conns[1];
    import_resolutions = await import_files_internal(files, reader_conn,
      icon_conn);
  } finally {
    if(reader_conn)
      reader_conn.close();
    if(icon_conn)
      icon_conn.close();
  }

  let num_feeds_imported = 0;
  for(const per_file_feed_count of import_resolutions)
    num_feeds_imported += per_file_feed_count;
  return num_feeds_imported;
}

// Returns promise resolving to [open_reader_conn, open_icon_conn]
function open_dbs() {
  let reader_db_name, reader_db_version, reader_db_connect_timeout_ms;
  let icon_db_name, icon_db_version, icon_db_conn_timeout_ms;
  const reader_conn_promise = reader_db.open(reader_db_name, reader_db_version,
    reader_db_connect_timeout_ms, verbose);
  const icon_conn_promise = favicon.open(icon_db_name, icon_db_version,
    icon_db_conn_timeout_ms, verbose);
  const conn_promises = [reader_conn_promise, icon_conn_promise];
  return Promise.all(conn_promises);
}

// Concurrently import files
function import_files_internal(files, reader_conn, icon_conn) {
  const promises = [];
  for(const file of files)
    promises.push(import_file_silently(file, reader_conn, icon_conn));
  return Promise.all(promises);
}

// Decorates import_file to avoid Promise.all failfast behavior
async function import_file_silently(file, reader_conn, icon_conn) {
  let num_feeds_added = 0;
  try {
    num_feeds_added = await import_file(file, reader_conn, icon_conn);
  } catch(error) {
    DEBUG(error);
  }
  return num_feeds_added;
}

// Returns number of feeds added
// TODO: if this no longer throws in the normal case, maybe I no longer need
// import_file_silently? Because now the Promise.all behavior would only
// failfast if there was a real, unexpected error
// TODO: instead of returning 0, return -1 to indicate error, and ensure
// caller is aware and does not naively sum result. Or return identified
// error codes? But it could also be 0 in case of no error but no new
// subscriptions.
async function import_file(file, reader_conn, icon_conn) {
  ASSERT(file);
  DEBUG('Importing opml file', file.name);

  if(file.size < 1) {
    DEBUG('file %s is 0 bytes', file.name);
    return 0;
  }

  if(!file_is_xml_type(file)) {
    DEBUG('file %s is not mime type xml', file.type);
    return 0;
  }

  let file_content_string;
  try {
    file_content_string = await file_read_as_text(file);
  } catch(error) {
    DEBUG(error);
    return 0;
  }

  // opml_parse returns null on error and does not throw in the normal case
  const document = opml_parse(file_content_string);
  if(!document) {
    DEBUG('error parsing opml file', file.name);
    return 0;
  }

  // TODO: this should be calls to local helper functions and probably do not
  // belong as functionality within OPMLDocument
  document.removeInvalidOutlineTypes();
  document.normalizeOutlineXMLUrls();
  document.removeOutlinesMissingXMLUrls();

  const outlines = document.getOutlineObjects();
  if(!outlines.length) {
    DEBUG('file %s contained 0 outlines', file.name);
    return 0;
  }

  const unique_outlines = aggregate_outlines_by_xmlurl(outlines);
  const dup_count = outlines.length - unique_outlines.length;
  if(dup_count)
    DEBUG('found %d duplicates in file', dup_count, file.name);

  normalize_outline_links(unique_outlines);
  const feeds = convert_outlines_to_feeds(unique_outlines);

  const sub_results = await sub_add_all(feeds, reader_conn, icon_conn);

  // Tally successful subscriptions
  let sub_count = 0;
  for(const sub_result of sub_results) {
    if(sub_result.status === subscription.OK)
      sub_count++;
  }

  DEBUG('subbed to %d of %d feeds in file', sub_count, feeds.length, file.name);
  return sub_count;
}

// Filter duplicates, favoring earlier in document order
function aggregate_outlines_by_xmlurl(outlines) {
  const unique_urls = [];
  const unique_outlines = [];
  for(const outline of outlines) {
    if(!unique_urls.includes(outline.xmlUrl)) {
      unique_outlines.push(outline);
      unique_urls.push(outline.xmlUrl);
    }
  }
  return unique_outlines;
}

// Normalize and validate each outline's link property
function normalize_outline_links(outlines) {
  // Setting to undefined is preferred over deleting in order to maintain v8
  // object shape
  for(let outline of outlines) {
    if(outline.htmlUrl === '') {
      outline.htmlUrl = undefined;
      continue;
    }

    if(outline.htmlUrl === null) {
      outline.htmlUrl = undefined;
      continue;
    }

    if(outline.htmlUrl === undefined)
      continue;

    try {
      const url_object = new URL(outline.htmlUrl);
      outline.htmlUrl = url_object.href;
    } catch(error) {
      outline.htmlUrl = undefined;
    }
  }
}

function convert_outlines_to_feeds(outlines) {
  const feeds = [];
  for(const outline of outlines) {
    const feed = convert_outline_to_feed(outline);
    feeds.push(feed);
  }
  return feeds;
}

function convert_outline_to_feed(outline) {
  const feed = {};

  if(outline.type) {
    feed.type = outline.type;
  }

  if(outline.title) {
    feed.title = outline.title;
  } else if(outline.text) {
    feed.text = outline.text;
  }

  if(outline.description) {
    feed.description = outline.description;
  }

  if(outline.htmlUrl) {
    feed.link = outline.htmlUrl;
  }

  feed_append_url(feed, outline.xmlUrl);

  return feed;
}

exports.import_opml_files = import_opml_files;

}(this));
