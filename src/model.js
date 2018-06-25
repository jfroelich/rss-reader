import assert from '/src/lib/assert.js';

// indexedDB does not support storing Function objects, because Function objects
// are not serializable. Therefore instanceof and typeof are not usable for
// making assertions about type. Therefore, use a hidden "magic" property to
// enable some minimal form of type checking.
export const FEED_MAGIC = 0xfeedfeed;
export const ENTRY_MAGIC = 0xdeadbeef;

export const ENTRY_STATE_UNREAD = 0;
export const ENTRY_STATE_READ = 1;
export const ENTRY_STATE_UNARCHIVED = 0;
export const ENTRY_STATE_ARCHIVED = 1;

export function create_feed() {
  return {magic: FEED_MAGIC};
}

export function create_entry() {
  return {magic: ENTRY_MAGIC};
}

// Function objects are not allowed, hence the duck-type check. Note that typeof
// null === 'object'
export function is_entry(value) {
  return value && typeof value === 'object' && value.magic === ENTRY_MAGIC;
}

export function is_feed(value) {
  return value && typeof value === 'object' && value.magic === FEED_MAGIC;
}

export function is_valid_entry_id(value) {
  return Number.isInteger(value) && value > 0;
}

export function is_valid_feed_id(id) {
  return Number.isInteger(id) && id > 0;
}

export function append_entry_url(entry, url) {
  assert(is_entry(entry));
  return append_url_common(entry, url);
}

export function append_feed_url(feed, url) {
  assert(is_feed(feed));
  return append_url_common(feed, url);
}

function append_url_common(object, url) {
  assert(typeof url.href === 'string');

  const normal_url_string = url.href;
  if (object.urls) {
    if (object.urls.includes(normal_url_string)) {
      return false;
    }

    object.urls.push(normal_url_string);
  } else {
    object.urls = [normal_url_string];
  }

  return true;
}

export function set_feed_date_fetched(feed, date) {
  feed.dateFetched = date;
}

export function set_feed_date_last_modified(feed, date) {
  feed.dateLastModifed = date;
}

export function set_feed_date_published(feed, date) {
  feed.datePublished = date;
}

export function set_feed_description(feed, description) {
  feed.description = description;
}

export function set_feed_link(feed, url_string) {
  feed.link = url_string;
}

export function set_feed_title(feed, title) {
  feed.title = title;
}

export function set_feed_type(feed, feed_type_string) {
  feed.type = feed_type_string;
}
