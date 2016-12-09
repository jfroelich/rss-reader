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

    const normURL = Feed.normalizeURL(url);
    if(feed.urls.includes(normURL)) {
      return false;
    }

    feed.urls.push(normURL);
    return true;
  }

  static normalizeURL(urlString) {
    const url = new URL(urlString);
    return url.href;
  }

  static sanitize(inputFeed) {
    const feed = Object.assign({}, inputFeed);

    if(feed.id) {
      if(!Number.isInteger(feed.id) || feed.id < 1)
        throw new TypeError();
    }

    const types = {'feed': 1, 'rss': 1, 'rdf': 1};
    if(feed.type && !(feed.type in types))
      throw new TypeError();

    if(feed.title) {
      let title = feed.title;
      title = StringUtils.filterControlChars(title);
      title = HTMLUtils.replaceTags(title, '');
      title = title.replace(/\s+/, ' ');
      const title_max_len = 1024;
      title = HTMLUtils.truncate(title, title_max_len, '');
      feed.title = title;
    }

    if(feed.description) {
      let description = feed.description;
      description = StringUtils.filterControlChars(description);
      description = HTMLUtils.replaceTags(description, '');
      description = description.replace(/\s+/, ' ');
      const before_len = description.length;
      const desc_max_len = 1024 * 10;
      description = HTMLUtils.truncate(description, desc_max_len, '');
      if(before_len > description.length) {
        console.warn('Truncated description', description);
      }

      feed.description = description;
    }

    return feed;
  }

  // Returns a new object of the old feed merged with the new feed. Fields from
  // the new feed take precedence, except for URLs, which are merged to generate
  // a distinct ordered set of oldest to newest url. Impure because of copying
  // by reference.
  static merge(oldFeed, newFeed) {
    const merged = Object.assign({}, oldFeed, newFeed);
    merged.urls = [...oldFeed.urls];
    for(let url of newFeed.urls) {
      Feed.addURL(merged, url);
    }
    return merged;
  }
}
