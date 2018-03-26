import {html_truncate} from '/src/lib/html-truncate/html-truncate.js';
import {html_replace_tags} from '/src/lib/html/html.js';
import * as object from '/src/lib/object/object.js';
import * as string from '/src/lib/string/string.js';

export const FEED_MAGIC = 0xfeedfeed;

export function feed_create() {
  return {magic: FEED_MAGIC};
}

// Return true if the value looks like a feed object
export function is_feed(value) {
  // While it perenially appears like the value condition is implied in the
  // typeof condition, this is not true. The value condition is short for value
  // !== null, because typeof null === 'object', and not checking value
  // definedness would cause value.magic to throw. The value condition is
  // checked first, because presumably it is cheaper than the typeof check.

  // indexedDB does not support storing Function objects, because Function
  // objects are not serializable (aka structured-cloneable), so we store basic
  // objects. Therefore, because instanceof is out of the question, and typeof
  // cannot get us any additional type guarantee beyond stating the value is
  // some object, we use a hidden property called magic to further guarantee the
  // type.
  return value && typeof value === 'object' && value.magic === FEED_MAGIC;
}

// Returns the url used to lookup a feed's favicon
// @returns {URL}
export function feed_create_favicon_lookup_url(feed) {
  assert(is_feed(feed));

  // First, prefer the link, as this is the url of the webpage that is
  // associated with the feed. Cannot assume the link is set or valid.
  if (feed.link) {
    try {
      return new URL(feed.link);
    } catch (error) {
      // If feed.link is set it should always be a valid URL
      console.warn(error);

      // If the url is invalid, just fall through
    }
  }

  // If the feed's link is missing/invalid then use the origin of the feed's
  // xml url. Assume the feed always has a url.
  const tail_url = new URL(feed_peek_url(feed));
  return new URL(tail_url.origin);
}

// Returns a shallow copy of the input feed with sanitized properties
export function feed_sanitize(feed, title_max_length, description_max_length) {
  if (typeof title_max_length === 'undefined') {
    title_max_length = 1024;
  }

  if (typeof description_max_length === 'undefined') {
    description_max_length = 1024 * 10;
  }

  const blank_feed = feed_create();
  const output_feed = Object.assign(blank_feed, feed);
  const html_tag_replacement = '';
  const suffix = '';

  if (output_feed.title) {
    let title = output_feed.title;
    title = string.filter_control_characters(title);
    title = html_replace_tags(title, html_tag_replacement);
    title = string.condense_whitespace(title);
    title = html_truncate(title, title_max_length, suffix);
    output_feed.title = title;
  }

  if (output_feed.description) {
    let desc = output_feed.description;
    desc = string.filter_control_characters(desc);
    desc = html_replace_tags(desc, html_tag_replacement);
    desc = string.condense_whitespace(desc);
    desc = html_truncate(desc, description_max_length, suffix);
    output_feed.description = desc;
  }

  return output_feed;
}

export function feed_prepare(feed) {
  return object.filter_empty_properties(feed_sanitize(feed));
}

// TODO: implement fully
// Return whether the feed has valid properties
// @param feed {any} any value, this should be a feed object, but it is not
// required
// @return {Boolean}
export function feed_is_valid(feed) {
  // feed_is_valid is generally called in the context of an assertion, so
  // while this could be its own assert, there is no need. It is simpler to
  // return here than throw an exception. It is, notably, generally an error to
  // ever call this function on something other than a feed, but that care is
  // left to the caller
  if (!is_feed(feed)) {
    return false;
  }

  // Validate the feed's id. It may not be present in the case of validating
  // a feed that has never been stored.
  if ('id' in feed && !feed_is_valid_id(feed.id)) {
    return false;
  }

  return true;
}

// Returns a new object that results from merging the old feed with the new
// feed. Fields from the new feed take precedence, except for urls, which are
// merged to generate a distinct ordered set of oldest to newest url. Impure
// because of copying by reference.
export function feed_merge(old_feed, new_feed) {
  const merged_feed = Object.assign(feed_create(), old_feed, new_feed);

  // After assignment, the merged feed has only the urls from the new feed. So
  // the output feed's url list needs to be fixed. First copy over the old
  // feed's urls, then try and append each new feed url.
  merged_feed.urls = [...old_feed.urls];

  if (new_feed.urls) {
    for (const url_string of new_feed.urls) {
      feed_append_url(merged_feed, new URL(url_string));
    }
  }

  return merged_feed;
}

// Appends a url to the feed's internal list. Lazily creates the list if needed
// @param feed {Object} a feed object
// @param url {URL}
export function feed_append_url(feed, url) {
  if (!is_feed(feed)) {
    console.error('Invalid feed argument:', feed);
    return false;
  }

  if (!(url instanceof URL)) {
    console.error('Invalid url argument:', url);
    return false;
  }

  feed.urls = feed.urls || [];
  const href = url.href;
  if (feed.urls.includes(href)) {
    return false;
  }
  feed.urls.push(href);
  return true;
}

// Returns the last url in the feed's url list as a string
// @param feed {Object} a feed object
// @returns {String} the last url in the feed's url list
// TODO: revert to tolerating some bad input (e.g. calling on feed without
// urls), review the typical peek operation api for other data structures in
// other code bases
export function feed_peek_url(feed) {
  assert(feed_has_url(feed));
  return feed.urls[feed.urls.length - 1];
}

export function feed_has_url(feed) {
  assert(is_feed(feed));
  return feed.urls && (feed.urls.length > 0);
}

export function feed_is_valid_id(id) {
  return Number.isInteger(id) && id > 0;
}

function assert(value) {
  if (!value) throw new Error('Assertion error');
}
