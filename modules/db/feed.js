// See license.md

'use strict';

class Feed {
  static getURL(feed) {
    if(!feed.urls.length)
      throw new TypeError();
    return feed.urls[feed.urls.length - 1];
  }

  static addURL(feed, url) {
    if(!('urls' in feed))
      feed.urls = [];

    const norm_url = Feed.normalizeURL(url);
    if(feed.urls.includes(norm_url)) {
      return false;
    }

    feed.urls.push(norm_url);
    return true;
  }

  static normalizeURL(url_str) {
    const url = new URL(url_str);
    return url.href;
  }

  static sanitize(input_feed) {
    const feed = Object.assign({}, input_feed);

    if(feed.id) {
      if(!Number.isInteger(feed.id) || feed.id < 1)
        throw new TypeError();
    }

    const types = {'feed': 1, 'rss': 1, 'rdf': 1};
    if(feed.type && !(feed.type in types))
      throw new TypeError();

    if(feed.title) {
      let title = feed.title;
      title = filter_control_chars(title);
      title = replace_tags(title, '');
      title = title.replace(/\s+/, ' ');
      const title_max_len = 1024;
      title = truncate_html(title, title_max_len, '');
      feed.title = title;
    }

    if(feed.description) {
      let description = feed.description;
      description = filter_control_chars(description);
      description = replace_tags(description, '');
      description = description.replace(/\s+/, ' ');
      const before_len = description.length;
      const desc_max_len = 1024 * 10;
      description = truncate_html(description, desc_max_len, '');
      if(before_len > description.length) {
        console.warn('Truncated description', description);
      }

      feed.description = description;
    }

    return feed;
  }

  // Returns a new object of the old feed merged with the new feed. Fields from
  // the new feed take precedence, except for URLs, which are merged to generate
  // a distinct ordered set of oldest to newest url. Impure.
  static merge(old_feed, new_feed) {
    const merged = Object.assign({}, old_feed, new_feed);
    merged.urls = [...old_feed.urls];
    for(let url of new_feed.urls) {
      Feed.addURL(merged, url);
    }
    return merged;
  }
}
