import {assert, AssertionError} from '/src/assert.js';
import * as cdb from '/src/cdb.js';
import * as config from '/src/config.js';
import {Deadline, INDEFINITE} from '/src/deadline.js';
import * as dom_filters from '/src/dom-filters.js';
import * as dom_utils from '/src/dom-utils.js';
import * as favicon from '/src/favicon.js';
import * as net from '/src/net.js';
import * as note from '/src/note.js';
import * as rewrite_rules from '/src/poll/rewrite-rules.js';
import {rewrite_url} from '/src/poll/rewrite-url.js';
import * as sniff from '/src/poll/url-sniff.js';
import * as utils from '/src/utils.js';

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
    assert(this instanceof PollOperation);
    const feeds = await this.get_pollable_feeds();
    console.debug('Loaded %d feeds', feeds.length);
    const promises = feeds.map(this.poll_feed, this);
    const results = await Promise.all(promises);

    // Calculate the total number of entries added across all feeds.
    let count = 0;
    for (const result of results) {
      // if (result) {
      count += result;
      //}
    }

    if (count) {
      const notif = {};
      notif.title = 'Added articles';
      notif.message = 'Added ' + count + ' articles';
      note.show(notif);
    }

    console.debug('Run completed, added %d entries', count);
  }

  async poll_feed(feed) {
    assert(this instanceof PollOperation);
    assert(cdb.is_feed(feed));

    console.debug('Polling feed', cdb.feed_get_url(feed));

    if (!cdb.feed_has_url(feed)) {
      return 0;
    }

    if (!feed.active) {
      return 0;
    }

    // NOTE: temporarily disabled during refactor/debug
    // if(this.polled_recently(feed.dateFetched)) {
    //  return 0;
    //}

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
        console.debug('Ephemeral fetch error', error);
        return 0;
      }

      // TEMP: researching issue
      console.debug('unknown fetch error', error);

      feed.errorCount =
          Number.isInteger(feed.errorCount) ? feed.errorCount + 1 : 1;
      if (feed.errorCount > this.deactivation_threshold) {
        console.debug('Deactivating feed', cdb.feed_get_url(feed));
        feed.active = false;
        feed.deactivationReasonText = 'fetch';
        feed.deactivationDate = new Date();
      }

      console.debug('Updating feed error count', feed);
      await cdb.update_feed(this.session, feed, true);
      return 0;
    }

    console.debug('fetch feed result:', fetch_result);

    // TEMP: debugging
    if (fetch_result === undefined) {
      console.warn('Undefined fetch-feed result');
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

    let counter = 0;
    const promises = entries.map(
        entry => this.poll_entry(
            entry, cdb.feed_get_url(feed), counter++, entries.length),
        this);
    const ids = await Promise.all(promises);
    const count = ids.reduce((sum, v) => v ? sum + 1 : sum, 0);

    if (this.notify && count) {
      const notif = {};
      notif.title = 'Added articles';
      notif.message = 'Added ' + count + ' articles for feed ' + feed.title;
      note.show(notif);
    }

    console.debug(
        'Completed polling feed %s, added %d entries', cdb.feed_get_url(feed),
        count);
    return count;
  }

  // Processes an entry and possibly adds it to the database. Attempts to fetch
  // the full text of the entry. Either returns the added entry id, or throws an
  // error.
  // TODO: if feed_url_string not in use, should not be param
  async poll_entry(entry, feed_url_string, entry_index, num_entries) {
    assert(this instanceof PollOperation);
    assert(cdb.is_entry(entry));
    assert(cdb.entry_has_url(entry));

    console.debug(
        'Polling entry', cdb.entry_get_url(entry), entry_index, num_entries);

    cdb.append_entry_url(
        entry,
        rewrite_url(new URL(cdb.entry_get_url(entry)), this.rewrite_rules));

    let existing = await cdb.get_entry(
        this.session, 'url', new URL(cdb.entry_get_url(entry)), true);
    if (existing) {
      console.debug('Entry exists', cdb.entry_get_url(entry));
      return 0;
    }

    // Fetch the entry full text. Reuse the url from above since it has not
    // changed. Trap fetch errors so that we can fall back to using feed content
    let response;
    let url = new URL(cdb.entry_get_url(entry));
    if ((url.protocol === 'http:' || url.protocol === 'https:') &&
        sniff.classify(url) !== sniff.BINARY_CLASS &&
        !this.url_is_inaccessible(url)) {
      try {
        response =
            await net.fetch_html(url, {timeout: this.fetch_html_timeout});
      } catch (error) {
        if (error instanceof AssertionError) {
          throw error;
        } else {
          console.debug('error fetching entry html', error);
        }
      }
    }

    // If we fetched and redirected, append the post-redirect response url, and
    // reapply url rewriting.
    let document;
    if (response) {
      let url_changed = false;
      url = new URL(cdb.entry_get_url(entry));
      const response_url = new URL(response.url);
      if (net.response_is_redirect(url, response)) {
        url_changed = true;
        cdb.append_entry_url(entry, response_url);
        cdb.append_entry_url(
            entry, rewrite_url(response_url, this.rewrite_rules));
        url = new URL(cdb.entry_get_url(entry));
        let existing = await cdb.get_entry(this.session, 'url', url, true);
        if (existing) {
          console.debug('entry redirect already exists', url.href);
          return 0;
        }
      }

      let response_text;
      try {
        response_text = await response.text();
        document = utils.parse_html(response_text);
      } catch (error) {
        if (error instanceof AssertionError) {
          throw error;
        } else {
          console.debug(error);
        }
      }
    } else {
      try {
        document = utils.parse_html(entry.content);
      } catch (error) {
        if (error instanceof AssertionError) {
          throw error;
        } else {
          console.debug(error);
          document = window.document.implementation.createHTMLDocument();
          document.documentElement.innerHTML =
              '<html><body>Malformed content</body></html>';
        }
      }
    }

    if (document && !entry.title) {
      const title_element = document.querySelector('html > head > title');
      if (title_element) {
        entry.title = title_element.textContent.trim();
      }
    }

    assert(document);
    const lookup_url = new URL(cdb.entry_get_url(entry));
    const lookup_request = new favicon.LookupRequest();
    lookup_request.conn = this.iconn;
    lookup_request.url = lookup_url;
    lookup_request.document = document;
    const icon_url_string = await favicon.lookup(lookup_request);
    if (icon_url_string) {
      entry.faviconURLString = icon_url_string;
    }

    dom_utils.set_base_uri(document, new URL(cdb.entry_get_url(entry)));


    // BUG: so the hang is definitely happening somewhere in filtering
    // TEMP
    if (true) {
      console.debug('temp skipping doc filtering', cdb.entry_get_url(entry));
      return 0;
    }

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

    console.debug('Filtering document for entry', cdb.entry_get_url(entry));
    await dom_filters.composite_document_filter(document, filter_options);
    console.debug('Filtered document for entry', cdb.entry_get_url(entry));
    assert(document.documentElement);

    entry.content = document.documentElement.outerHTML;
    cdb.sanitize_entry(entry);
    cdb.validate_entry(entry);

    console.debug('Creating entry in db', cdb.entry_get_url(entry));
    const id = await cdb.create_entry(this.session, entry);
    return id;
  }

  polled_recently(last_fetch_date) {
    if (this.ignore_recency_check) {
      return false;
    }

    if (!this.recency_period) {
      return false;
    }

    if (!last_fetch_date) {
      return false;
    }

    const now = new Date();
    const elapsed = now - last_fetch_date;
    return elapsed > 0 && elapsed < this.recency_period;
  }

  fetch_feed(feed) {
    const options = {};
    options.timeout = this.fetch_feed_timeout;
    options.skip_entries = false;
    options.resolve_entry_urls = true;
    const url = new URL(cdb.feed_get_url(feed));
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
    const merged_feed = Object.assign(cdb.construct_feed(), old_feed, new_feed);
    merged_feed.urls = [...old_feed.urls];
    if (new_feed.urls) {
      for (const url_string of new_feed.urls) {
        cdb.append_feed_url(merged_feed, new URL(url_string));
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
        console.warn('Skipping undefined entry in entries list');
        continue;
      }

      // TODO: use cdb.entry_has_url
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
    const blank_entry = cdb.construct_entry();
    // Clone to avoid mutation
    const clone = Object.assign(blank_entry, parsed_entry);

    // Convert link to url
    delete clone.link;
    if (parsed_entry.link) {
      try {
        cdb.append_entry_url(clone, new URL(parsed_entry.link));
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
