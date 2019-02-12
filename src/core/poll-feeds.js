// TODO: re-envision this module as just a specific helper to ops.js, callers
// should be proxied through ops.js poll-feeds call, instead of directly
// interacting with this module

import * as cdb from '/src/core/cdb.js';
import * as dom_filters from '/src/core/dom-filters.js';
import * as dom_utils from '/src/core/dom-utils.js';
import * as favicon from '/src/core/favicon.js';
import * as net from '/src/core/net.js';
import * as rewrite_rules from '/src/core/rewrite-rules.js';
import * as sniffer from '/src/core/sniffer.js';
import * as utils from '/src/core/utils.js';
import {assert, AssertionError} from '/src/lib/assert.js';
import * as config from '/src/lib/config.js';
import {Deadline, INDEFINITE} from '/src/lib/deadline.js';

export class PollOperation {
  constructor() {
    this.ignore_recency_check = false;
    this.recency_period = 5 * 60 * 1000;
    this.fetch_feed_timeout = new Deadline(5000);
    this.fetch_html_timeout = new Deadline(5000);
    this.fetch_image_timeout = new Deadline(3000);
    this.deactivation_threshold = 10;
    this.notify = true;
    this.session = undefined;
    // favicon db connection
    this.iconn = undefined;
    this.rewrite_rules = rewrite_rules.build();

    // TODO: somehow store in configuration instead of here, look into
    // deserializing using Regex constructor or something
    this.inaccessible_content_descriptors = [
      {pattern: /forbes\.com$/i, reason: 'interstitial-advert'},
      {pattern: /productforums\.google\.com$/i, reason: 'script-generated'},
      {pattern: /groups\.google\.com$/i, reason: 'script-generated'},
      {pattern: /nytimes\.com$/i, reason: 'paywall'},
      {pattern: /wsj\.com$/i, reason: 'paywall'}
    ];
  }

  // Returns a promise that resolves to an array of feeds
  get_pollable_feeds() {
    return cdb.get_feeds(this.session, 'active', /* sorted */ false);
  }

  async run() {
    if (this.recency_period && !this.ignore_recency_check) {
      const stamp = parseInt(localStorage.last_poll_date, 10);
      if (!isNaN(stamp)) {
        const now = new Date();
        const stamp_date = new Date(stamp);
        const millis_elapsed = now - stamp_date;
        assert(elapsed >= 0);
        if (elapsed < this.recency_period) {
          console.debug('Polled too recently', elapsed);
          return;
        }
      }
    }

    localStorage.last_poll_date = '' + Date.now();

    const feeds = await this.get_pollable_feeds();
    console.debug('Loaded %d feeds', feeds.length);
    const promises = feeds.map(this.poll_feed, this);
    const results = await Promise.all(promises);

    // Calculate the total number of entries added across all feeds.
    let count = 0;
    for (const result of results) {
      count += result;
    }

    if (count) {
      const note = {};
      note.title = 'Added articles';
      note.message = 'Added ' + count + ' articles';
      utils.show_notification(config, note);
    }

    console.debug('Run completed, added %d entries', count);
  }

  async poll_feed(feed) {
    assert(cdb.is_feed(feed));

    if (!cdb.Feed.prototype.hasURL.call(feed)) {
      console.debug('Feed missing url', feed);
      return 0;
    }

    console.debug('Polling feed', cdb.Feed.prototype.getURLString.call(feed));

    if (!feed.active) {
      console.debug('Feed is inactive', feed);
      return 0;
    }

    let fetch_result;
    try {
      fetch_result = await this.fetch_feed(feed);
    } catch (error) {
      if (error instanceof AssertionError) {
        console.error(error);
        throw error;
      }

      // If failed to fetch with temp error, stop processing the feed and exit
      if (error instanceof net.TimeoutError ||
          error instanceof net.OfflineError) {
        console.warn(error);
        return 0;
      }

      feed.errorCount =
          Number.isInteger(feed.errorCount) ? feed.errorCount + 1 : 1;
      if (feed.errorCount > this.deactivation_threshold) {
        console.debug(
            'Marking feed inactive',
            cdb.Feed.prototype.getURLString.call(feed));
        feed.active = false;
        feed.deactivationReasonText = 'fetch';
        feed.deactivationDate = new Date();
      }

      console.debug('Updating feed on fetch error', feed);
      await cdb.update_feed(this.session, feed, true);
      return 0;
    }

    // fetch-feed currently yields a custom object with props
    // feed/entries/http-response, do a minor assertion
    assert(typeof fetch_result === 'object');

    feed = this.merge_feed(feed, fetch_result.feed);

    // Decrement error count on success
    if (!isNaN(feed.errorCount) && feed.errorCount > 0) {
      feed.errorCount--;
    } else {
      delete feed.errorCount;
    }

    cdb.validate_feed(feed);
    cdb.sanitize_feed(feed);
    await cdb.update_feed(this.session, feed, true);

    // Now poll the feed's entries
    let entries = fetch_result.entries.map(this.coerce_entry);
    entries = this.dedup_entries(entries);

    for (const entry of entries) {
      entry.feed = feed.id;
      entry.feedTitle = feed.title;
      entry.faviconURLString = feed.faviconURLString;
      if (feed.datePublished && !entry.datePublished) {
        entry.datePublished = feed.datePublished;
      }
    }

    const promises = entries.map(
        (entry => this.poll_entry(
             entry, cdb.Feed.prototype.getURLString.call(feed))),
        this);
    const ids = await Promise.all(promises);
    const count = ids.reduce((sum, v) => v ? sum + 1 : sum, 0);

    if (this.notify && count) {
      const note = {};
      note.title = 'Added articles';
      note.message = 'Added ' + count + ' articles for feed ' + feed.title;
      utils.show_notification(config, note);
    }

    console.debug(
        'Completed polling feed %s, added %d entries',
        cdb.Feed.prototype.getURLString.call(feed), count);
    return count;
  }

  // Processes an entry and possibly adds it to the database. Attempts to fetch
  // the full text of the entry. Either returns the added entry id, or throws an
  // error.
  // TODO: if feed_url_string not in use, should not be param
  async poll_entry(entry, feed_url_string) {
    assert(this instanceof PollOperation);
    assert(cdb.is_entry(entry));
    assert(cdb.Entry.prototype.hasURL.call(entry));

    cdb.Entry.prototype.appendURL.call(
        entry,
        rewrite_url(
            new URL(cdb.Entry.prototype.getURLString.call(entry)),
            this.rewrite_rules));

    let existing = await cdb.get_entry(
        this.session, 'url',
        new URL(cdb.Entry.prototype.getURLString.call(entry)), true);
    if (existing) {
      return 0;
    }

    // Fetch the entry full text. Reuse the url from above since it has not
    // changed. Trap fetch errors so that we can fall back to using feed content
    let response;
    let url = new URL(cdb.Entry.prototype.getURLString.call(entry));
    if ((url.protocol === 'http:' || url.protocol === 'https:') &&
        sniffer.classify(url) !== sniffer.BINARY_CLASS &&
        !this.url_is_inaccessible(url)) {
      try {
        response =
            await net.fetch_html(url, {timeout: this.fetch_html_timeout});
      } catch (error) {
        if (error instanceof AssertionError) {
          throw error;
        } else {
          // Ignore
        }
      }
    }

    // If we fetched and redirected, append the post-redirect response url, and
    // reapply url rewriting.

    // NOTE: there is something really strange going, so do not use a variable
    // named document here to try to flesh out the bug

    let doc;
    if (response) {
      let url_changed = false;
      url = new URL(cdb.Entry.prototype.getURLString.call(entry));
      const response_url = new URL(response.url);
      if (net.response_is_redirect(url, response)) {
        url_changed = true;
        cdb.Entry.prototype.appendURL.call(entry, response_url);
        cdb.Entry.prototype.appendURL.call(
            entry, rewrite_url(response_url, this.rewrite_rules));
        url = new URL(cdb.Entry.prototype.getURLString.call(entry));
        let existing = await cdb.get_entry(this.session, 'url', url, true);
        if (existing) {
          return 0;
        }
      }

      let response_text;
      try {
        response_text = await response.text();
        doc = utils.parse_html(response_text);
      } catch (error) {
        if (error instanceof AssertionError) {
          throw error;
        } else {
          // ignore
        }
      }
    } else {
      try {
        doc = utils.parse_html(entry.content);
      } catch (error) {
        if (error instanceof AssertionError) {
          throw error;
        } else {
          doc = window.document.implementation.createHTMLDocument();
          doc.documentElement.innerHTML =
              '<html><body>Malformed content</body></html>';
        }
      }
    }

    assert(doc instanceof Document);

    const old_base_uri = doc.baseURI;
    dom_utils.set_base_uri(
        doc, new URL(cdb.Entry.prototype.getURLString.call(entry)));

    // If title was not present in the feed xml, try and pull it from content
    if (!entry.title) {
      const title_element = doc.querySelector('html > head > title');
      if (title_element) {
        entry.title = title_element.textContent.trim();
      }
    }

    // Set the entry's favicon
    const lookup_url = new URL(cdb.Entry.prototype.getURLString.call(entry));
    const lookup_request = new favicon.LookupRequest();
    lookup_request.conn = this.iconn;
    lookup_request.url = lookup_url;
    lookup_request.document = doc;
    const icon_url_string = await favicon.lookup(lookup_request);
    if (icon_url_string) {
      entry.faviconURLString = icon_url_string;
    }

    // Filter the document content
    const filter_options = {};
    filter_options.contrast_matte = config.read_int('contrast_default_matte');
    filter_options.contrast_ratio = config.read_float('min_contrast_ratio');
    // Deserialize from config as a Deadline, not a raw int
    const config_set_image_sz_to = config.read_int('set_image_sizes_timeout');
    if (!isNaN(config_set_image_sz_to)) {
      filter_options.image_size_timeout = new Deadline(config_set_image_sz_to);
    }

    filter_options.table_scan_max_rows = config.read_int('table_scan_max_rows');

    // NOTE: may be NaN if not set or invalid value, only set if valid, this
    // was previously a bug
    const config_emph_max_len = config.read_int('emphasis_max_length');
    if (!isNaN(config_emph_max_len)) {
      filter_options.emphasis_max_length = config_emph_max_len;
    }

    filter_options.is_allowed_request = net.is_allowed_request;

    const composite_promise =
        dom_filters.composite_document_filter(doc, filter_options);
    await composite_promise;
    assert(doc.documentElement);

    entry.content = doc.documentElement.outerHTML;
    cdb.sanitize_entry(entry);
    cdb.validate_entry(entry);

    // We do not need to await but I am for now due to what seems like an
    // unrelated error but may be related, the await rules out this having
    // anything to do with it
    return await this.create_entry(entry);
  }

  create_entry(entry) {
    assert(cdb.is_entry(entry));
    return cdb.create_entry(this.session, entry);
  }

  fetch_feed(feed) {
    const options = {};
    options.timeout = this.fetch_feed_timeout;
    options.skip_entries = false;
    options.resolve_entry_urls = true;
    const url = new URL(cdb.Feed.prototype.getURLString.call(feed));
    return net.fetch_feed(url, options);
  }

  // Returns a new object that results from merging the old feed with the new
  // feed. Fields from the new feed take precedence, except for urls, which are
  // merged to generate a distinct ordered set of oldest to newest url. Impure
  // because of copying by reference. Internally, after assignment, the merged
  // feed has only the urls from the new feed. So the output feed's url array
  // needs to be fixed. First copy over the old feed's urls, then try and append
  // each new feed url.
  merge_feed(old_feed, new_feed) {
    const merged_feed = Object.assign(new cdb.Feed(), old_feed, new_feed);
    merged_feed.urls = [...old_feed.urls];
    if (new_feed.urls) {
      for (const url_string of new_feed.urls) {
        cdb.Feed.prototype.appendURL.call(merged_feed, new URL(url_string));
      }
    }

    return merged_feed;
  }

  dedup_entries(entries) {
    assert(Array.isArray(entries));

    const distinct_entries = [];
    const seen_url_strings = [];

    for (const entry of entries) {
      if (!entry) {
        continue;
      }

      // TODO: use cdb.Entry.prototype.hasURL
      if (!entry.urls || entry.urls.length < 1) {
        distinct_entries.push(entry);
        continue;
      }

      let url_is_seen = false;
      for (const url_string of entry.urls) {
        if (seen_url_strings.includes(url_string)) {
          url_is_seen = true;
          break;
        }
      }

      if (!url_is_seen) {
        distinct_entries.push(entry);

        // TODO: do not naively push all, that makes seen grow larger than it
        // needs to be because it creates dupes
        seen_url_strings.push(...entry.urls);
      }
    }

    return distinct_entries;
  }

  // Convert a parsed entry into a cdb-formatted entry
  // TODO: now that this function is no longer in a separate lib, maybe the
  // clone is just silly.
  coerce_entry(parsed_entry) {
    const blank_entry = new cdb.Entry();
    // Clone to avoid mutation
    const clone = Object.assign(blank_entry, parsed_entry);

    // Convert link to url
    delete clone.link;
    if (parsed_entry.link) {
      try {
        cdb.Entry.prototype.appendURL.call(clone, new URL(parsed_entry.link));
      } catch (error) {
        if (error instanceof AssertionError) {
          throw error;
        } else {
          // ignore
        }
      }
    }

    return clone;
  }

  url_is_inaccessible(url) {
    for (const desc of this.inaccessible_content_descriptors) {
      if (desc.pattern && desc.pattern.test(url.hostname)) {
        return true;
      }
    }
    return false;
  }
}

export function rewrite_url(url, rules) {
  let prev = url;
  let next = url;
  for (const rule of rules) {
    prev = next;
    next = rule(prev) || prev;
  }
  return next;
}
