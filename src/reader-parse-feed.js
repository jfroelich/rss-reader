'use strict';

// import base/errors.js
// import net/url.js
// import entry.js
// import feed-parse.js

// Parses an xml input string representing a feed. Returns a result with a
// status, a feed object, and an array of entries.
function reader_parse_feed(xml_string, request_url, response_url,
  last_mod_date, process_entries) {

  const result = {
    'status': RDR_OK,
    'feed': undefined,
    'entries': []
  };

  let parse_result;
  try {
    parse_result = feed_parse_from_string(xml_string);
  } catch(error) {
    console.warn(error);
    result.status = RDR_ERR_PARSE;
    return result;
  }

  const feed = parse_result.feed;
  reader_feed_parse_setup_feed(feed, request_url, response_url, last_mod_date);
  result.feed = feed;

  let base_url;
  try {
    base_url = new URL(feed.link);
  } catch(error) {
    // Ignore for now. If entries are relative they will all be filtered
    // later.
  }

  if(process_entries) {
    result.entries = reader_feed_parse_setup_entries(parse_result.entries,
      base_url);
  }

  return result;
}

function reader_feed_parse_setup_feed(feed, request_url, response_url,
  last_mod_date) {

  // Compose fetch urls as the initial feed urls
  feed_append_url(feed, request_url);
  feed_append_url(feed, response_url);

  // Normalize feed link if set and valid, otherwise set to undefined
  if(feed.link && url_is_canonical(feed.link)) {
    try {
      const feed_link_url = new URL(feed.link);
      feed.link = feed_link_url.href;
    } catch(error) {
      console.debug('error parsing feed link url', feed.link, error);
      feed.link = undefined;
    }
  } else {
    feed.link = undefined;
  }

  if(!feed.datePublished) {
    feed.datePublished = new Date();
  }

  feed.dateFetched = new Date();
  feed.dateLastModified = last_mod_date;
}

function reader_feed_parse_setup_entries(entries, base_url) {
  for(const entry of entries) {
    reader_parse_feed_resolve(entry, base_url);
  }

  for(const entry of entries) {
    reader_parse_feed_coerce_entry(entry);
  }

  entries = reader_parse_feed_filter_dup_entries(entries);
  return entries;
}


// If the entry has a link property, canonicalize and normalize it
// base_url is optional, generally should be feed.link
function reader_parse_feed_resolve(entry, base_url) {
  console.assert(entry_is_entry(entry));
  if(entry.link) {
    try {
      const url = new URL(entry.link, base_url);
      entry.link = url.href;
    } catch(error) {
      console.debug(entry.link, error);
      entry.link = undefined;
    }
  }
}

// entries are fetched as objects with a link property. for each entry that
// has a link, convert it into the app's storage format that uses a urls
// array. this tolerates entries that do not have links
function reader_parse_feed_coerce_entry(entry) {
  if(entry.link) {
    try {
      entry_append_url(entry, entry.link);
    } catch(error) {
      console.warn('failed to coerce link to url', entry.link);
    }

    delete entry.link;
  }
}

function reader_parse_feed_filter_dup_entries(entries) {
  const distinct_entries = [];
  const seen_urls = [];

  for(const entry of entries) {

    // Retain entries without urls in the output without comparison
    if(!entry_has_url(entry)) {
      distinct_entries.push(entry);
      continue;
    }

    let is_seen_url = false;

    for(const url_string of entry.urls) {
      if(seen_urls.includes(url_string)) {
        is_seen_url = true;
        break;
      }
    }

    if(!is_seen_url) {
      distinct_entries.push(entry);
      seen_urls.push(...entry.urls);
    }
  }

  return distinct_entries;
}
