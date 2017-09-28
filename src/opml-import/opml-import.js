(function(exports) {
'use strict';

async function import_opml_files(files, verbose) {
  if(verbose)
    console.log('Importing %d OPML XML files', files.length);

  let reader_conn, icon_conn, import_resolutions;
  try {
    const connections = await open_dbs();
    reader_conn = connections[0];
    icon_conn = connections[1];
    import_resolutions = await import_files_internal(reader_conn, icon_conn,
      files, verbose);
  } finally {
    if(reader_conn)
      reader_conn.close();
    if(icon_conn)
      icon_conn.close();
  }

  let num_feeds_imported = 0;
  for(const per_file_feed_count of import_resolutions)
    num_feeds_imported += per_file_feed_count;

  if(verbose)
    console.log('Imported %d feeds from %d files', num_feeds_imported,
      files.length);

  return num_feeds_imported;
}

// Returns promise resolving to [open_reader_conn, open_icon_conn]
function open_dbs() {
  let reader_db_name, reader_db_version, reader_db_connect_timeout_ms;
  let icon_db_name, icon_db_version, icon_db_conn_timeout_ms;
  const reader_conn_promise = reader_open_db(reader_db_name, reader_db_version,
    reader_db_connect_timeout_ms, verbose);
  const icon_conn_promise = favicon_open_db(icon_db_name, icon_db_version,
    icon_db_conn_timeout_ms, verbose);
  const conn_promises = [reader_conn_promise, icon_conn_promise];
  return Promise.all(conn_promises);
}

// Concurrently import files
function import_files_internal(reader_conn, icon_conn, files, verbose) {
  const promises = [];
  for(const file of files) {
    const promise = import_file_silently(reader_conn, icon_conn, file, verbose);
    promises.push(promise);
  }

  return Promise.all(promises);
}

// Decorates import_file to avoid Promise.all failfast behavior
async function import_file_silently(reader_conn, icon_conn, file, verbose) {
  let num_feeds_added = 0;
  try {
    num_feeds_added = await import_file(reader_conn, icon_conn, file, verbose);
  } catch(error) {
    if(verbose)
      console.warn(error);
  }
  return num_feeds_added;
}

// Returns number of feeds added
async function import_file(reader_conn, icon_conn, file, verbose) {
  if(verbose)
    console.log('Importing file', file.name);
  if(file.size < 1)
    throw new TypeError(`The file "${file.name}" is empty`);

  if(!is_supported_file_type(file.type))
    throw new TypeError(`"${file.name}" has unsupported type "${file.type}"`);

  const text = await read_file_as_text(file);

  // Allow parse errors to bubble
  const document = parse_opml(text);

  document.removeInvalidOutlineTypes();
  document.normalizeOutlineXMLUrls();
  document.removeOutlinesMissingXMLUrls();

  const outlines = document.getOutlineObjects();
  let resolutions;
  if(outlines.length) {
    const unique_outlines = aggregate_outlines_by_xmlurl(outlines);

    // TODO: only calc dup_count if verbose
    const dup_count = outlines.length - unique_outlines.length;
    if(dup_count && verbose)
      console.log('Ignored %d duplicate feed(s) in file', dup_count, file.name);

    normalize_outline_links(unique_outlines);
    const feeds = convert_outlines_to_feeds(unique_outlines);

    let subscribe_timeout_ms;
    resolutions = await subscribe_all(feeds, reader_conn, icon_conn,
      subscribe_timeout_ms, verbose);
  }

  let num_feeds_added = 0;
  if(resolutions) {
    for(let resolution of resolutions) {
      if(resolution)
        num_feeds_added++;
    }
  }

  if(verbose)
    console.log('Subscribed to %d feeds in file', num_feeds_added, file.name);
  return num_feeds_added;
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

  Feed.prototype.add_url.call(feed, outline.xmlUrl);

  return feed;
}


function is_supported_file_type(file_type) {
  let normal_type = file_type || '';
  normal_type = normal_type.trim().toLowerCase();
  const supported_types = ['application/xml', 'text/xml'];
  return supported_types.includes(normal_type);
}

function read_file_as_text(file) {
  function resolver(resolve, reject) {
    const reader = new FileReader();
    reader.readAsText(file);
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
  }
  return new Promise(resolver);
}

exports.import_opml_files = import_opml_files;

}(this));
