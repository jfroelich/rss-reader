'use strict';

// import net/url.js
// import entry.js
// import feed.js

// Post fetch processing that coerces a fetched feed into the app's internal
// storage format.
// @param feed {Object} a fetched feed object
// @param request_url {String}
// @param response_url {String}
// @param last_mod_date {Date}
function coerce_fetched_feed(feed, request_url, response_url, last_mod_date) {
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
  return feed;
}

// If the entry has a link property, canonicalize and normalize it
// base_url is optional
function canonicalize_fetched_entry_link(entry, base_url) {
  console.assert(entry_is_entry(entry));
  if(entry.link) {
    try {
      const url = new URL(entry.link, base_url);
      entry.link = url.href;
    } catch(error) {
      console.debug(entry.link, error);
      delete entry.link;
    }
  }
}

// entries are fetched as objects with a link property. for each entry that
// has a link, convert it into the app's storage format that uses a urls
// array. this tolerates entries that do not have links
function coerce_fetched_entry_to_storage_format(entry) {
  if(entry.link) {
    try {
      entry_append_url(entry, entry.link);
    } catch(error) {
      console.warn('failed to coerce link to url', entry.link);
    }

    delete entry.link;
  }
}
