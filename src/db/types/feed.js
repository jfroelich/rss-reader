import {assert} from '/src/assert.js';
import * as magic from '/src/db/types/magic.js';
import filter_controls from '/src/db/utils/filter-controls.js';
import replace_tags from '/src/db/utils/replace-tags.js';
import truncate_html from '/src/db/utils/truncate-html.js';
import {append_url_common, is_date_lte, is_valid_date, vassert} from '/src/db/utils/utils.js';

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
    title = filter_controls(title);
    title = replace_tags(title, html_tag_replacement);
    title = condense_whitespace(title);
    title = truncate_html(title, title_max_len, repl_suffix);
    feed.title = title;
  }

  if (feed.description) {
    let desc = feed.description;
    desc = filter_controls(desc);
    desc = replace_tags(desc, html_tag_replacement);
    desc = condense_whitespace(desc);
    desc = truncate_html(desc, desc_max_len, repl_suffix);
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
};

export function is_feed(value) {
  return value && typeof value === 'object' && value.magic === magic.FEED_MAGIC;
}

function condense_whitespace(value) {
  return value.replace(/\s\s+/g, ' ');
}
