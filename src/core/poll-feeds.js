import * as cdb from '/src/core/db/cdb.js';
import * as desknote from '/src/core/desknote.js';
import * as dom_filters from '/src/core/dom-filters/dom-filters.js';
import {fetch_feed} from '/src/core/fetch-feed.js';
import * as rewrite_rules from '/src/core/rewrite-rules.js';
import {assert, AssertionError} from '/src/lib/assert.js';
import {Deadline, INDEFINITE} from '/src/lib/deadline.js';
import * as document_utils from '/src/lib/document-utils.js';
import * as favicon from '/src/lib/favicon.js';
import {fetch_html} from '/src/lib/fetch-html.js';
import * as html_utils from '/src/lib/html-utils.js';
import * as net from '/src/lib/net.js';
import * as sniffer from '/src/lib/sniffer.js';
import * as tls from '/src/lib/tls.js';

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
    this.iconn = undefined;
    this.rewrite_rules = rewrite_rules.build();

    this.inaccessible_content_descriptors = [
      {pattern: /forbes\.com$/i, reason: 'interstitial-advert'},
      {pattern: /productforums\.google\.com$/i, reason: 'script-generated'},
      {pattern: /groups\.google\.com$/i, reason: 'script-generated'},
      {pattern: /nytimes\.com$/i, reason: 'paywall'},
      {pattern: /wsj\.com$/i, reason: 'paywall'}
    ];
  }

  async run() {
    // Cancel the run if the last run was too recent
    if (this.recency_period && !this.ignore_recency_check) {
      // TODO: access via local storage utils or config
      const stamp = parseInt(localStorage.last_poll_date, 10);
      if (!isNaN(stamp)) {
        const now = new Date();
        const stamp_date = new Date(stamp);
        const millis_elapsed = now - stamp_date;
        assert(millis_elapsed >= 0);
        if (millis_elapsed < this.recency_period) {
          console.debug('Polled too recently', millis_elapsed);
          return;
        }
      }
    }

    localStorage.last_poll_date = '' + Date.now();

    const feeds = await this.session.getFeeds('active', false);
    console.debug('Loaded %d active feeds for polling', feeds.length);
    const promises = feeds.map(this.pollFeed, this);
    const results = await Promise.all(promises);

    // Calculate the total number of entries added across all feeds.
    let count = 0;
    for (const result of results) {
      count += result;
    }

    if (this.notify && count > 0) {
      const note = {};
      note.title = 'Added articles';
      note.message = 'Added ' + count + ' articles';
      desknote.show(note);
    }

    console.debug('Poll feeds completed, added %d entries', count);
  }

  async pollFeed(feed) {
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
      fetch_result = await this.fetchFeed(feed);
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
      await this.session.updateFeed(feed, true);
      return 0;
    }

    // fetch-feed currently yields a custom object with props
    // feed/entries/http-response, do a minor assertion
    assert(typeof fetch_result === 'object');

    feed = this.mergeFeed(feed, fetch_result.feed);

    // Decrement error count on success
    if (!isNaN(feed.errorCount) && feed.errorCount > 0) {
      feed.errorCount--;
    } else {
      delete feed.errorCount;
    }

    cdb.CDB.validateFeed(feed);
    cdb.CDB.sanitizeFeed(feed);
    await this.session.updateFeed(feed, true);

    // Now poll the feed's entries
    let entries = fetch_result.entries.map(this.coerceEntry);
    entries = this.dedupEntries(entries);

    for (const entry of entries) {
      entry.feed = feed.id;
      entry.feedTitle = feed.title;
      entry.faviconURLString = feed.faviconURLString;
      if (feed.datePublished && !entry.datePublished) {
        entry.datePublished = feed.datePublished;
      }
    }

    const promises = entries.map(this.pollEntry, this);
    const ids = await Promise.all(promises);
    const count = ids.reduce((sum, v) => v ? sum + 1 : sum, 0);

    if (this.notify && count) {
      const note = {};
      note.title = 'Added articles';
      note.message = 'Added ' + count + ' articles for feed ' + feed.title;
      desknote.show(note);
    }

    console.debug(
        'Completed polling feed %s, added %d entries',
        cdb.Feed.prototype.getURLString.call(feed), count);
    return count;
  }

  // Processes an entry and possibly adds it to the database. Attempts to fetch
  // the full text of the entry. Returns a promise that resolves to the new
  // entry id, 0 if the entry exists, or rejects with an error.
  async pollEntry(entry) {
    assert(this instanceof PollOperation);
    assert(cdb.is_entry(entry));
    assert(cdb.Entry.prototype.hasURL.call(entry));

    cdb.Entry.prototype.appendURL.call(
        entry,
        rewrite_url(
            new URL(cdb.Entry.prototype.getURLString.call(entry)),
            this.rewrite_rules));
    let existing = await this.session.getEntry(
        'url', new URL(cdb.Entry.prototype.getURLString.call(entry)), true);
    if (existing) {
      return Promise.resolve(0);
    }

    // Fetch the entry full text. Reuse the url from above since it has not
    // changed. Trap fetch errors so that we can fall back to using feed content
    let response;
    let url = new URL(cdb.Entry.prototype.getURLString.call(entry));
    if ((url.protocol === 'http:' || url.protocol === 'https:') &&
        sniffer.classify(url) !== sniffer.BINARY_CLASS &&
        !this.isAccessibleURL(url)) {
      try {
        response = await fetch_html(url, {timeout: this.fetch_html_timeout});
      } catch (error) {
        if (error instanceof AssertionError) {
          throw error;
        } else {
          // Ignore
        }
      }
    }

    // If we fetched and redirected, append the post-redirect response url, and
    // reapply url rewriting, and check again for existence
    let doc;
    if (response) {
      let url_changed = false;
      url = new URL(cdb.Entry.prototype.getURLString.call(entry));
      const response_url = new URL(response.url);
      if (net.is_redirect(url, response)) {
        url_changed = true;
        cdb.Entry.prototype.appendURL.call(entry, response_url);
        cdb.Entry.prototype.appendURL.call(
            entry, rewrite_url(response_url, this.rewrite_rules));
        url = new URL(cdb.Entry.prototype.getURLString.call(entry));
        let existing = await this.session.getEntry('url', url, true);
        if (existing) {
          return Promise.resolve(0);
        }
      }

      let response_text;
      try {
        response_text = await response.text();
        doc = html_utils.parse_html(response_text);
      } catch (error) {
        if (error instanceof AssertionError) {
          throw error;
        } else {
          // ignore
        }
      }
    } else {
      try {
        doc = html_utils.parse_html(entry.content);
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
    document_utils.set_base_uri(
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
    filter_options.contrast_matte = tls.read_int('contrast_default_matte');
    filter_options.contrast_ratio = tls.read_float('min_contrast_ratio');
    // Deserialize from settings as a Deadline, not a raw int
    const config_set_image_sz_to = tls.read_int('set_image_sizes_timeout');
    if (!isNaN(config_set_image_sz_to)) {
      filter_options.image_size_timeout = new Deadline(config_set_image_sz_to);
    }

    filter_options.table_scan_max_rows = tls.read_int('table_scan_max_rows');

    const config_emph_max_len = tls.read_int('emphasis_max_length');
    if (!isNaN(config_emph_max_len)) {
      filter_options.emphasis_max_length = config_emph_max_len;
    }

    filter_options.empty_frame_body_message =
        'Unable to display document because it uses HTML frames';
    await dom_filters.composite_document_filter(doc, filter_options);

    // TODO: this is overly paranoid and should be removed, I believe it is an
    // artifact of a previous bug
    assert(doc.documentElement);

    entry.content = doc.documentElement.outerHTML;
    cdb.CDB.sanitizeEntry(entry);
    cdb.CDB.validateEntry(entry);

    return await this.session.createEntry(entry);
  }

  fetchFeed(feed) {
    const options = {};
    options.timeout = this.fetch_feed_timeout;
    options.skip_entries = false;
    options.resolve_entry_urls = true;
    const url = new URL(cdb.Feed.prototype.getURLString.call(feed));
    return fetch_feed(url, options);
  }

  // Returns a new feed object that results from merging the old feed with the
  // new feed. Values from the new feed take precedence, except for urls, which
  // are merged to generate an ordered set.
  mergeFeed(old_feed, new_feed) {
    const merged_feed = Object.assign(new cdb.Feed(), old_feed, new_feed);
    merged_feed.urls = [...old_feed.urls];
    if (new_feed.urls) {
      for (const url_string of new_feed.urls) {
        cdb.Feed.prototype.appendURL.call(merged_feed, new URL(url_string));
      }
    }

    return merged_feed;
  }

  dedupEntries(entries) {
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
  // TODO: skip clone and mutate
  coerceEntry(parsed_entry) {
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

  isAccessibleURL(url) {
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
