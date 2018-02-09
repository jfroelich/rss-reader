import {entry_append_url, entry_create, entry_has_url, feed_append_url, feed_create} from '/src/rdb.js';

// TODO: I enabled entry url resolution in feed_parse. This should no longer
// do entry url resolution.

// TODO: once coerce_feed and coerce_entries are implemented, then
// coerce_feed_and_entries basically consists of calling those two functions.
// What I should do is then deprecate coerce_feed_and_entries, and move the 2
// function calls into the calling context. Then there is the plus of no longer
// needing the process_entries_flag param, because caller simply decides whether
// to call both coerce_feed and coerce_entries or just one of them.

// Give a parsed feed object and some fetch information, creates new storable
// feed and entry objects
export default function coerce_feed_and_entries(
    parsed_feed, fetch_info, process_entries_flag) {
  const request_url = fetch_info.request_url;
  const response_url = fetch_info.response_url;
  const response_last_modified_date = fetch_info.response_last_modified_date;

  assert(request_url instanceof URL);
  assert(response_url instanceof URL);

  // Create a new blank feed into which we copy certain properties
  const feed = feed_create();

  // Append urls to the feed
  feed_append_url(feed, request_url);
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

  // TODO: review if i copied over all correct feed properties


  if (!process_entries_flag) {
    return {feed: feed, entries: []};
  }

  const entries = parsed_feed.entries;
  assert(Array.isArray(entries));

  const result = {feed: feed, entries: null};
  result.entries = entries.map(coerce_entry);
  return result;
}

// TODO: implement. This should basically generate a storage-formatted feed
// object using the section of coerce_feed_and_entries
function coerce_feed(parsed_feed) {}

// TODO: implement, this should be the other half of coerce_feed_and_entries
// Note that in doing so I need to rethink how to set entry urls. I should
// just reparse feed.link directly from parsed feed instead of relying on any
// output of coerce_feed
function coerce_entries() {}


// Coerce a parsed entry object into a reader storage entry object.
function coerce_entry(parsed_entry) {
  // Create a blank entry, and copy over all properties from the parsed entry
  const storable_entry = Object.assign(entry_create(), parsed_entry);

  // The link has already been resolved using the feed link as the base url.
  // This was done by feed_parse. At least, it is better to say, this now
  // assumes that was done, and no longer does it here as well

  // Mutate the storable entry
  entry_convert_link_to_url(storable_entry);
  return storable_entry;
}

/*
// DEPRECATED. WILL FULLY DELETE AFTER MORE TESTING
// If the entry has a link property, canonicalize and normalize it, base_url is
// optional, generally should be feed.link
function entry_resolve_link(entry, base_url) {
  if (entry.link) {
    try {
      const url = new URL(entry.link, base_url);
      entry.link = url.href;
    } catch (error) {
      console.debug(error);
      entry.link = undefined;
    }
  }
}
*/

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
