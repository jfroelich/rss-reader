// See license.md

'use strict';

// Utility functions related to working with feed objects

// Get the url currently representing the feed, which is the final url in its
// internal urls array.
function getFeedURLString(feed) {
  if(!feed.urls.length) {
    throw new TypeError('feed urls array is invalid');
  }

  return feed.urls[feed.urls.length - 1];
}

// Add a new url to the feed. Lazily creates the urls property.
function addFeedURLString(feed, urlString) {
  if(!('urls' in feed)) {
    feed.urls = [];
  }
  const normalizedURLString = normalizeFeedURLString(urlString);
  if(feed.urls.includes(normalizedURLString)) {
    return false;
  }
  feed.urls.push(normalizedURLString);
  return true;
};

function normalizeFeedURLString(urlString) {
  const url = new URL(urlString);
  return url.href;
}

// Creates a url object that can be used as input to favicon.lookup
function createFeedIconLookupURL(feed) {
  // Cannot assume the link is set nor valid
  if(feed.link) {
    try {
      return new URL(feed.link);
    } catch(error) {
      console.warn(error);
    }
  }

  // If the link is missing or invalid then use the origin
  // Assume the feed always has a url.
  const feedURLString = getFeedURLString(feed);
  const feedURLObject = new URL(feedURLString);
  const originString = feedURLObject.origin;
  return new URL(originString);
}

// TODO: sanitize is not same as validate, this should not validate, this is
// a conflation of functionality
function sanitizeFeed(inputFeedObject) {
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
    title = filterControlCharacters(title);
    title = replaceHTML(title, '');
    title = title.replace(/\s+/, ' ');
    const titleMaxLength = 1024;
    title = truncateHTML(title, titleMaxLength, '');
    outputFeedObject.title = title;
  }

  if(outputFeedObject.description) {
    let description = outputFeedObject.description;
    description = filterControlCharacters(description);
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
}

// Returns a new object that results from merging the old feed with the new
// feed. Fields from the new feed take precedence, except for URLs, which are
// merged to generate a distinct ordered set of oldest to newest url. Impure
// because of copying by reference.
function mergeFeed(oldFeedObject, newFeedObject) {
  const mergedFeedObject = Object.assign({}, oldFeedObject, newFeedObject);
  mergedFeedObject.urls = [...oldFeedObject.urls];

  for(let urlString of newFeedObject.urls) {
    addFeedURLString(mergedFeedObject, urlString);
  }
  return mergedFeedObject;
}
