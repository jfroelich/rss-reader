// Utilities for working with feed objects (in serializable storage format).

// ### is_feed
// Return true if the value looks like a feed object. While it perenially
// appears like the value condition is implied in the typeof condition, this is
// not true. The value condition is short for `value !== null`, because `typeof
// null === 'object'`, and not checking value defined-ness would cause
// value.magic to throw. The value condition is checked first, because
// presumably it is cheaper than the typeof check.

// indexedDB does not support storing Function objects, because Function objects
// are not serializable (aka structured-cloneable), so we store basic objects.
// Therefore, because instanceof is out of the question, and typeof cannot get
// us any additional type guarantee beyond stating the value is some object, we
// use a hidden property called magic to further guarantee the type.

// ## append_feed_url notes
// Appends a url to the feed's internal list. Lazily creates the list if needed
// * @param feed {Object} a feed object
// * @param url {URL}

// ### is_valid_feed notes
// TODO: implement fully
// Return whether the feed has valid properties
// @param feed {any} any value, this should be a feed object, but it is not
// required
// @return {Boolean}
// is_valid_feed is generally called in the context of an assertion, so
// while this could be its own assert, there is no need. It is simpler to
// return here than throw an exception. It is, notably, generally an error to
// ever call this function on something other than a feed, but that care is
// left to the caller
// Validate the feed's id. It may not be present in the case of validating
// a feed that has never been stored.

// ### TODOs
// * for `coerce_feed`, think about fetch info parameter more, I'd prefer maybe
// to just accept a Response object. But I don't know how to get request url.
// * for `coerce_feed`, think more about separating out the integration of fetch
// information from coercion. This kind of mixes it all together and I do not
// like that.

export const FEED_MAGIC = 0xfeedfeed;

export function create_feed() {
  return {magic: FEED_MAGIC};
}

export function is_feed(value) {
  return value && typeof value === 'object' && value.magic === FEED_MAGIC;
}

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
