// Library for importing an opml file into the database

// Dependencies:
// favicon.js
// feed.js
// file.js
// opml.js
// reader-db.js
// subscribe.js


// Import the collection of opml files
// @param files {FileList}
// TODO: reintroduce conn parameters
async function opml_import(files) {
  'use strict';
  ASSERT(files);
  DEBUG('importing %d files', files.length);

  let reader_conn, icon_conn, import_resolutions;
  try {
    const conns = await opml_import_open_dbs();
    reader_conn = conns[0];
    icon_conn = conns[1];
    import_resolutions = await opml_import_files(files, reader_conn,
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
function opml_import_open_dbs() {
  'use strict';
  let reader_db_name, reader_db_version, reader_db_connect_timeout_ms;
  let icon_db_name, icon_db_version, icon_db_conn_timeout_ms;
  const reader_conn_promise = reader_db_open(reader_db_name, reader_db_version,
    reader_db_connect_timeout_ms);
  const icon_conn_promise = favicon.open(icon_db_name, icon_db_version,
    icon_db_conn_timeout_ms);
  const conn_promises = [reader_conn_promise, icon_conn_promise];
  return Promise.all(conn_promises);
}

function opml_import_files(files, reader_conn, icon_conn) {
  'use strict';
  const promises = [];
  for(const file of files)
    promises.push(opml_import_file_silently(file, reader_conn, icon_conn));
  return Promise.all(promises);
}

// Decorates opml_import_file to avoid Promise.all failfast behavior
async function opml_import_file_silently(file, reader_conn, icon_conn) {
  'use strict';
  let num_feeds_added = 0;
  try {
    num_feeds_added = await opml_import_file(file, reader_conn, icon_conn);
  } catch(error) {
    DEBUG(error);
  }
  return num_feeds_added;
}

// Returns number of feeds added
// TODO: if this no longer throws in the normal case, maybe I no longer need
// opml_import_file_silently? Because now the Promise.all behavior would
// only fail fast if there was a real, unexpected error
// TODO: instead of returning 0, return -1 to indicate error, and ensure
// caller is aware and does not naively sum result. Or return identified
// error codes? But it could also be 0 in case of no error but no new
// subscriptions.
async function opml_import_file(file, reader_conn, icon_conn) {
  'use strict';
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

  let file_content; // String
  try {
    file_content = await file_read_as_text(file);
  } catch(error) {
    DEBUG(error);
    return 0;
  }

  let [status, document] = opml_parse_from_string(file_content);
  if(status !== STATUS_OK) {
    DEBUG('error parsing opml file', file.name);
    return 0;
  }

  // TODO: these should be calls to local helper functions instead of in the
  // general library. These functions are specific to import and are not
  // general purpose functions.
  opml_remove_outlines_with_invalid_types(document);
  opml_normalize_outline_xmlurls(document);
  opml_remove_outlines_missing_xmlurls(document);

  const outlines = opml_get_outline_objects(document);
  if(!outlines.length) {
    DEBUG('file %s contained 0 outlines', file.name);
    return 0;
  }

  const unique_outlines = opml_import_group_outlines(outlines);
  const dup_outline_count = outlines.length - unique_outlines.length;
  DEBUG('found %d duplicates in file', dup_outline_count, file.name);

  opml_import_normalize_links(unique_outlines);
  const feeds = opml_import_outlines_to_feeds(unique_outlines);

  const sub_results = await sub_add_all(feeds, reader_conn, icon_conn);

  // Tally successful subscriptions
  let sub_count = 0;
  for(const sub_result of sub_results) {
    if(sub_result.status === STATUS_OK)
      sub_count++;
  }

  DEBUG('subbed to %d of %d feeds in file', sub_count, feeds.length, file.name);
  return sub_count;
}

// Filter duplicates, favoring earlier in document order
function opml_import_group_outlines(outlines) {
  'use strict';
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
function opml_import_normalize_links(outlines) {
  'use strict';
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

function opml_import_outlines_to_feeds(outlines) {
  'use strict';
  const feeds = [];
  for(const outline of outlines)
    feeds.push(opml_import_outline_to_feed(outline));
  return feeds;
}

function opml_import_outline_to_feed(outline) {
  'use strict';
  const feed = {};
  if(outline.type)
    feed.type = outline.type;
  if(outline.title)
    feed.title = outline.title;
  if(outline.text)
    feed.text = outline.text;
  if(outline.description)
    feed.description = outline.description;
  if(outline.htmlUrl)
    feed.link = outline.htmlUrl;
  feed_append_url(feed, outline.xmlUrl);
  return feed;
}
