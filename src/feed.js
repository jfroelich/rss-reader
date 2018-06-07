// Utilities for working with feed objects (in serializable storage format).

// indexedDB does not support storing Function objects, because Function objects
// are not serializable (aka structured-cloneable), so we store basic objects.
// Therefore, because instanceof is out of the question, and typeof cannot get
// us any additional type guarantee beyond stating the value is some object, we
// use a hidden property called magic to further guarantee the type.
export const FEED_MAGIC = 0xfeedfeed;

export function create_feed() {
  return {magic: FEED_MAGIC};
}

// Return true if the value looks like a feed object. While it perenially
// appears like the value condition is implied in the typeof condition, this is
// not true. The value condition is short for `value !== null`, because `typeof
// null === 'object'`, and not checking value defined-ness would cause
// value.magic to throw. The value condition is checked first, because
// presumably it is cheaper than the typeof check.
export function is_feed(value) {
  return value && typeof value === 'object' && value.magic === FEED_MAGIC;
}

// Appends a url to the feed's internal list. Lazily creates the list if needed
// * @param feed {Object} a feed object
// * @param url {URL}
export function append_feed_url(feed, url) {
  if (!is_feed(feed)) {
    throw new TypeError('Invalid feed argument ' + feed);
    return false;
  }

  // Duck-typed sanity check
  const href = url.href;
  if (typeof href !== 'string') {
    throw new TypeError('Invalid url argument ' + url);
    return false;
  }

  // Lazy init
  if (!feed.urls) {
    feed.urls = [];
  }

  if (feed.urls.includes(href)) {
    return false;
  }
  feed.urls.push(href);
  return true;
}

export function is_valid_feed_id(id) {
  return Number.isInteger(id) && id > 0;
}

export function coerce_feed(parsed_feed, fetch_info) {
  const request_url = fetch_info.request_url;
  const response_url = fetch_info.response_url;
  const response_last_modified_date = fetch_info.response_last_modified_date;

  assert(request_url instanceof URL);
  assert(response_url instanceof URL);

  const feed = create_feed();

  if (parsed_feed.type) {
    feed.type = parsed_feed.type;
  }

  append_feed_url(feed, request_url);
  append_feed_url(feed, response_url);

  if (parsed_feed.link) {
    try {
      const url = new URL(parsed_feed.link);
      feed.link = url.href;
    } catch (error) {
    }
  }

  if (parsed_feed.title) {
    feed.title = parsed_feed.title;
  }

  if (parsed_feed.description) {
    feed.description = parsed_feed.description;
  }

  if (parsed_feed.datePublished) {
    feed.datePublished = parsed_feed.datePublished;
  } else {
    feed.datePublished = new Date();
  }

  feed.dateFetched = new Date();
  feed.dateLastModified = response_last_modified_date;
  return feed;
}

function assert(value) {
  if (!value) throw new Error('Assertion error');
}
