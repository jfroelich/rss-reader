import {entry_append_url, entry_create, entry_has_url, feed_append_url, feed_create} from '/src/rdb.js';

// TODO: split into two files, coerce-feed.js and coerce-entries.js

export function coerce_feed(parsed_feed, fetch_info) {
  const request_url = fetch_info.request_url;
  const response_url = fetch_info.response_url;
  const response_last_modified_date = fetch_info.response_last_modified_date;

  assert(request_url instanceof URL);
  assert(response_url instanceof URL);

  // Create a new blank feed into which we copy certain properties
  const feed = feed_create();

  // Copy over type
  if (parsed_feed.type) {
    feed.type = parsed_feed.type;
  }

  // Copy over urls using fetch info
  feed_append_url(feed, request_url);

  // feed_append_url automatically detects duplication and maintains uniqueness
  // of the urls set, so not our concern
  feed_append_url(feed, response_url);

  // Set the feed's link property. There is no guarantee the parsed feed's link
  // value is set, nor valid. This only sets if valid.
  if (parsed_feed.link) {
    try {
      const url = new URL(parsed_feed.link);
      feed.link = url.href;
    } catch (error) {
      // Ignore
    }
  }

  // Set title
  if (parsed_feed.title) {
    feed.title = parsed_feed.title;
  }

  // Set description
  if (parsed_feed.description) {
    feed.description = parsed_feed.description;
  }

  // Set date published
  if (parsed_feed.datePublished) {
    feed.datePublished = parsed_feed.datePublished;
  } else {
    feed.datePublished = new Date();
  }

  // Initialize fetch date to now
  feed.dateFetched = new Date();

  // Initialize date last modified to response last modified date
  feed.dateLastModified = response_last_modified_date;

  return feed;
}

export function coerce_entries(parsed_entries) {
  assert(Array.isArray(parsed_entries));
  return parsed_entries.map(coerce_entry);
}

// Coerce a parsed entry object into a reader storage entry object.
function coerce_entry(parsed_entry) {
  // Create a blank entry, and copy over all properties from the parsed entry
  const blank_storable_entry = entry_create();
  const storable_entry = Object.assign(blank_storable_entry, parsed_entry);

  // The link has already been resolved using the feed link as the base url.
  // This was done by feed_parse. At least, it is better to say, this now
  // assumes that was done, and no longer does it here as well

  // Mutate the storable entry
  entry_convert_link_to_url(storable_entry);
  return storable_entry;
}

// entries are fetched as objects with a link property. for each entry that has
// a link, convert it into the app's storage format that uses a urls array. this
// tolerates entries that do not have links
function entry_convert_link_to_url(entry) {
  if ('link' in entry) {
    try {
      const url = new URL(entry.link);
      entry_append_url(entry, url);
    } catch (error) {
      console.debug('Failed to coerce entry link to url', entry.link);
    }

    // Regardless of above, unset
    delete entry.link;
  }
}

function assert(value, message) {
  if (!value) throw new Error(message || 'Assertion error');
}
