import {html_truncate} from '/src/html-truncate/html-truncate.js';
import {html_replace_tags} from '/src/html/html.js';
import * as object from '/src/object/object.js';
import * as rdb from '/src/rdb/rdb.js';
import * as string from '/src/string/string.js';

const FEED_MAGIC = 0xfeedfeed;


// Returns the url used to lookup a feed's favicon
// @returns {URL}
export function feed_create_favicon_lookup_url(feed) {
  assert(rdb.is_feed(feed));

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
  const tail_url = new URL(rdb.feed_peek_url(feed));
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

  const blank_feed = rdb.feed_create();
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
  if (!rdb.is_feed(feed)) {
    return false;
  }

  // Validate the feed's id. It may not be present in the case of validating
  // a feed that has never been stored.
  if ('id' in feed && !rdb.feed_is_valid_id(feed.id)) {
    return false;
  }

  return true;
}
