// See license.md

'use strict';

/*
- remove the defined title requirement, have options manually sort feeds instead
of using the title index
*/

const Feed = {};

Feed.getURL = function(feed) {
  if(!feed.urls.length) {
    throw new Error('Feed missing url');
  }

  return feed.urls[feed.urls.length - 1];
};

Feed.addURL = function(feed, url) {
  if(!('urls' in feed)) {
    feed.urls = [];
  }

  const normURL = Feed.normalizeURL(url);
  if(feed.urls.includes(normURL)) {
    return false;
  }

  feed.urls.push(normURL);
  return true;
};

Feed.normalizeURL = function(urlString) {
  const urlObject = new URL(urlString);
  urlObject.hash = '';
  return urlObject.href;
};

Feed.sanitize = function(inputFeed) {
  const feed = Object.assign({}, inputFeed);

  if(feed.id) {
    if(!Number.isInteger(feed.id) || feed.id < 1) {
      throw new Error(`Invalid feed id: ${feed.id}`);
    }
  }

  const types = {'feed': 1, 'rss': 1, 'rdf': 1};
  if(feed.type) {
    if(!(feed.type in types)) {
      throw new Error(`Invalid feed type: ${feed.type}`);
    }
  }

  if(feed.title) {
    let title = feed.title;
    title = filterControlChars(title);
    title = replaceTags(title, '');
    title = title.replace(/\s+/, ' ');
    const titleMaxStoreLength = 1024;
    title = truncateHTML(title, titleMaxStoreLength, '');
    feed.title = title;
  }

  if(feed.description) {
    let description = feed.description;
    description = filterControlChars(description);
    description = replaceTags(description, '');
    description = description.replace(/\s+/, ' ');
    const preTruncLen = description.length;
    const descMaxLength = 1024 * 10;
    description = truncateHTML(description, descMaxLength, '');
    if(preTruncLen > description.length) {
      console.warn('Truncated description', description);
    }

    feed.description = description;
  }

  return feed;
};

// Returns a new object of the old feed merged with the new feed. Fields from
// the new feed take precedence, except for URLs, which are merged to generate
// a distinct ordered set of oldest to newest url. Impure.
Feed.merge = function(oldFeed, newFeed) {
  const mergedFeed = Object.assign({}, oldFeed, newFeed);
  mergedFeed.urls = [...oldFeed.urls];
  for(let url of newFeed.urls) {
    Feed.addURL(mergedFeed, url);
  }
  return mergedFeed;
};
