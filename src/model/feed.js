import {assert} from '/src/lib/assert.js';
import * as html_utils from '/src/lib/html-utils.js';
import * as string_utils from '/src/lib/string-utils.js';
import * as magic from '/src/model/magic.js';
import {append_url_common, is_date_lte, is_valid_date, vassert} from '/src/model/utils.js';

export function Feed() {
  this.magic = magic.FEED_MAGIC;
}

Feed.INVALID_ID = 0;

Feed.prototype.appendURL = function(url) {
  assert(is_feed(this));
  return append_url_common(this, url);
};

Feed.prototype.getURLString = function() {
  assert(is_feed(this));
  assert(Feed.prototype.hasURL.call(this));
  return this.urls[this.urls.length - 1];
};

Feed.prototype.hasURL = function() {
  assert(is_feed(this));
  return Array.isArray(this.urls) && this.urls.length;
};

Feed.isValidId = function(value) {
  return Number.isInteger(value) && value > 0;
};

Feed.sanitize = function(feed, title_max_len = 1024, desc_max_len = 10240) {
  assert(is_feed(feed));

  const html_tag_replacement = '';
  const repl_suffix = '';

  if (feed.title) {
    let title = feed.title;
    title = string_utils.filter_controls(title);
    title = html_utils.replace_tags(title, html_tag_replacement);
    title = string_utils.condense_whitespace(title);
    title = html_utils.truncate_html(title, title_max_len, repl_suffix);
    feed.title = title;
  }

  if (feed.description) {
    let desc = feed.description;
    desc = string_utils.filter_controls(desc);
    desc = html_utils.replace_tags(desc, html_tag_replacement);
    desc = string_utils.condense_whitespace(desc);
    desc = html_utils.truncate_html(desc, desc_max_len, repl_suffix);
    feed.description = desc;
  }
};

Feed.validate = function(feed) {
  assert(is_feed(feed));
  const now = new Date();

  vassert(feed.id === undefined || Feed.isValidId(feed.id));
  vassert(
      feed.active === undefined || feed.active === true ||
      feed.active === false);
  vassert(feed.urls === undefined || Array.isArray(feed.urls));
  vassert(feed.title === undefined || typeof feed.title === 'string');
  vassert(
      feed.type === undefined || feed.type === 'rss' || feed.type === 'feed' ||
      feed.type === 'rdf');
  vassert(feed.link === undefined || typeof feed.link === 'string');
  vassert(
      feed.description === undefined || typeof feed.description === 'string');
  vassert(
      feed.deactivationReasonText === undefined ||
      typeof feed.deactivationReasonText === 'string');

  vassert(is_valid_date(feed.deactivateDate));
  vassert(is_date_lte(feed.deactivateDate, now));
  vassert(is_valid_date(feed.dateCreated));
  vassert(is_date_lte(feed.dateCreated, now));
  vassert(is_date_lte(feed.dateCreated, feed.deactivateDate));
  vassert(is_valid_date(feed.dateUpdated));
  vassert(is_date_lte(feed.dateUpdated, now));
  vassert(is_date_lte(feed.dateCreated, feed.dateUpdated));
  vassert(is_valid_date(feed.datePublished));
  vassert(is_date_lte(feed.datePublished, now));
  vassert(is_valid_date(feed.dateFetched));
  vassert(is_date_lte(feed.dateFetched, now));
};

export function is_feed(value) {
  return value && typeof value === 'object' && value.magic === magic.FEED_MAGIC;
}
