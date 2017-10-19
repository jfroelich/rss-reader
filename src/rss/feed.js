// Feed utilities

'use strict';

// Dependencies:
// assert.js

// Create a new feed object
function feed_create() {
  return {};
}

function feed_is_valid_feed_id(id) {
  return Number.isInteger(id) && id > 0;
}

// Returns the last url in the feed's url list as a string
// @param feed {Object} a feed object
// @returns {String} the last url in the feed's url list
function feed_get_top_url(feed) {
  ASSERT(feed && feed.urls && feed.urls.length);
  return feed.urls[feed.urls.length - 1];
}

// Appends a url to the feed's internal list. Lazily creates the list if needed
// @param feed {Object} a feed object
// @param url_string {String}
function feed_append_url(feed, url_string) {
  feed.urls = feed.urls || [];
  const url_object = new URL(url_string);
  const norm_url_string = url_object.href;
  if(feed.urls.includes(norm_url_string))
    return false;
  feed.urls.push(norm_url_string);
  return true;
}

// Creates a url object that can be used as input to favicon_lookup
// @returns {URL}
function feed_create_icon_lookup_url(feed) {
  ASSERT(feed);

  // Cannot assume the link is set nor valid
  if(feed.link) {
    try {
      return new URL(feed.link);
    } catch(error) {
    }
  }

  // If the link is missing or invalid then use the origin
  // Assume the feed always has a url.
  const url_string = feed_get_top_url(feed);
  const url_object = new URL(url_string);
  const origin_url_string = url_object.origin;
  return new URL(origin_url_string);
}

// Update's a feed's faviconURLString property (not persisted to db)
// TODO: change this to not throw an error so that caller
// try/catch is not needed in the usual case
async function feed_update_favicon(feed, icon_conn) {
  const lookup_url_object = feed_create_icon_lookup_url(feed);
  let max_age_ms, fetch_html_timeout_ms, fetch_img_timeout_ms,
    min_img_size, max_img_size;

  // Allow exceptions to bubble
  const icon_url_string = await favicon_lookup(icon_conn, lookup_url_object,
    max_age_ms, fetch_html_timeout_ms, fetch_img_timeout_ms, min_img_size,
    max_img_size);
  feed.faviconURLString = icon_url_string;
}

// TODO: include this in places where sanitize is called
// TODO: assert required properties are present
// TODO: assert type, if set, is one of the valid types
// TODO: assert feed has one or more urls
// TODO: assert the type of each property?
function feed_has_valid_props(feed) {
  ASSERT(feed);

  if('id' in feed) {
    ASSERT(Number.isInteger(feed.id));
    ASSERT(feed.id > 0);
  }

  if('type' in feed) {
    const types = ['feed', 'rss', 'rdf'];
    ASSERT(types.includes(feed.type));
  }
}

// Returns a shallow copy of the input feed with sanitized properties
function feed_sanitize(feed, title_max_length, desc_max_length) {
  ASSERT(feed);

  const DEFAULT_TITLE_MAX_LEN = 1024;
  const DEFAULT_DESC_MAX_LEN = 1024 * 10;

  if(typeof title_max_length === 'undefined')
    title_max_length = DEFAULT_TITLE_MAX_LEN;
  if(typeof desc_max_length === 'undefined')
    desc_max_length = DEFAULT_DESC_MAX_LEN;

  const output_feed = Object.assign({}, feed);
  const empty_tag_replacement = '';
  if(output_feed.title) {
    let title = output_feed.title;
    title = string_filter_control_chars(title);
    title = html_replace_tags(title, empty_tag_replacement);
    title = string_condense_whitespace(title);
    const truncated_title_suffix = '';
    title = html_truncate(title, title_max_length, truncated_title_suffix);
    output_feed.title = title;
  }

  if(output_feed.description) {
    let desc = output_feed.description;
    desc = string_filter_control_chars(desc);
    desc = html_replace_tags(desc, empty_tag_replacement);
    desc = string_condense_whitespace(desc);
    const truncated_desc_suffix = '';
    desc = html_truncate(desc, desc_max_length, truncated_desc_suffix);
    output_feed.description = desc;
  }

  return output_feed;
}

// Returns a new object that results from merging the old feed with the new
// feed. Fields from the new feed take precedence, except for urls, which are
// merged to generate a distinct ordered set of oldest to newest url. Impure
// because of copying by reference.
function feed_merge(old_feed, new_feed) {
  const merged_feed_object = Object.assign({}, old_feed, new_feed);

  // After assignment, the merged feed has only the urls from the new feed.
  // So the output feed's url list needs to be fixed. First copy over the old
  // feed's urls, then try and append each new feed url.
  merged_feed_object.urls = [...old_feed.urls];
  if(new_feed.urls)
    for(const url_string of new_feed.urls)
      feed_append_url(merged_feed_object, url_string);

  return merged_feed_object;
}
