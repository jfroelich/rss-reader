// See license.md

'use strict';

const feed = {};

// Get the url currently representing the feed
feed.getURLString = function(feedObject) {
  if(!feedObject.urls.length) {
    throw new TypeError('feedObject urls array is invalid');
  }

  return feedObject.urls[feedObject.urls.length - 1];
};

// Add a new url to the feed
feed.addURLString = function(feedObject, url) {
  if(!('urls' in feedObject)) {
    feedObject.urls = [];
  }
  const normalizedURLString = feed.normalizeURLString(url);
  if(feedObject.urls.includes(normalizedURLString)) {
    return false;
  }
  feedObject.urls.push(normalizedURLString);
  return true;
};

feed.normalizeURLString = function(urlString) {
  const url = new URL(urlString);
  return url.href;
};

// TODO: sanitize is not same as validate, this should not validate, this is
// a conflation of functionality

feed.sanitize = function(inputFeedObject) {
  const outputFeedObject = Object.assign({}, inputFeedObject);

  if(outputFeedObject.id) {
    if(!Number.isInteger(outputFeedObject.id) || outputFeedObject.id < 1) {
      throw new TypeError('Invalid feed id');
    }
  }

  const types = {'feed': 1, 'rss': 1, 'rdf': 1};
  if(outputFeedObject.type && !(outputFeedObject.type in types)) {
    throw new TypeError();
  }

  if(outputFeedObject.title) {
    let title = outputFeedObject.title;
    title = utils.filterControlCharacters(title);
    title = replaceHTML(title, '');
    title = title.replace(/\s+/, ' ');
    const titleMaxLength = 1024;
    title = truncateHTML(title, titleMaxLength, '');
    outputFeedObject.title = title;
  }

  if(outputFeedObject.description) {
    let description = outputFeedObject.description;
    description = utils.filterControlCharacters(description);
    description = replaceHTML(description, '');
    description = description.replace(/\s+/, ' ');
    const beforeLength = description.length;
    const descriptionMaxLength = 1024 * 10;
    description = truncateHTML(description, descriptionMaxLength, '');

    if(beforeLength > description.length) {
      // console.warn('Truncated description', description);
    }

    outputFeedObject.description = description;
  }

  return outputFeedObject;
};

// Returns a new object of the old feed merged with the new feed. Fields from
// the new feed take precedence, except for URLs, which are merged to generate
// a distinct ordered set of oldest to newest url. Impure because of copying
// by reference.
feed.merge = function(oldFeedObject, newFeedObject) {
  const mergedFeedObject = Object.assign({}, oldFeedObject, newFeedObject);
  mergedFeedObject.urls = [...oldFeedObject.urls];

  for(let urlString of newFeedObject.urls) {
    feed.addURLString(mergedFeedObject, urlString);
  }
  return mergedFeedObject;
};
