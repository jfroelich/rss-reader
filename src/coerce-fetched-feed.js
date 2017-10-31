'use strict';

// import entry.js
// import feed.js
// import feed-parse.js

// Post fetch processing that coerces a fetched feed into the app's internal
// format.
function coerce_fetched_feed(feed, request_url, response_url, last_mod_date) {
  if(typeof feed.link !== 'string' || !url_is_canonical(feed.link)) {
    return [RDR_ERR_PARSE];
  }

  let feed_link_url;
  try {
    feed_link_url = new URL(feed.link);
  } catch(error) {
    return [RDR_ERR_PARSE];
  }
  feed.link = feed_link_url.href;

  if(!feed.datePublished) {
    feed.datePublished = new Date();
  }

  feed_append_url(feed, request_url);
  feed_append_url(feed, response_url);
  feed.dateFetched = new Date();
  feed.dateLastModified = last_mod_date;
  return [RDR_OK, feed];
}

function canonicalize_entry_links(entries, base_url) {
  console.assert(Array.isArray(entries));
  console.assert(url_is_url_object(base_url));

  let out_entries = [];

  for(const entry of entries) {
    if(entry.link) {
      out_entries.push(entry);
    }
  }

  // Normalize and canonicalize and filter entry links
  const entries_with_valid_links = [];
  for(const entry of out_entries) {
    try {
      const entry_link_url = new URL(entry.link, base_url);
      entry.link = entry_link_url.href;
      entries_with_valid_links.push(entry);
    } catch(error) {
      console.debug(error);
    }
  }
  out_entries = entries_with_valid_links;

  // Now that we have entries with valid link fields, coerce them into
  // the storage format
  for(const entry of out_entries) {
    entry_append_url(entry, entry.link);

    // The link property does not exist in the storage format. Cannot maintain
    // v8 object shape.
    delete entry.link;
  }

  return out_entries;
}
