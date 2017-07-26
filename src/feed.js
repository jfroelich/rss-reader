// See license.md

'use strict';

// Utility functions related to working with feeds and entries

const ENTRY_STATE_UNREAD = 0;
const ENTRY_STATE_READ = 1;
const ENTRY_STATE_UNARCHIVED = 0;
const ENTRY_STATE_ARCHIVED = 1;

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
}

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
function sanitizeFeed(inputFeed) {
  const outputFeed = Object.assign({}, inputFeed);

  if(outputFeed.id) {
    if(!Number.isInteger(outputFeed.id) || outputFeed.id < 1) {
      throw new TypeError('Invalid feed id');
    }
  }

  const types = {'feed': 1, 'rss': 1, 'rdf': 1};
  if(outputFeed.type && !(outputFeed.type in types)) {
    throw new TypeError();
  }

  if(outputFeed.title) {
    let title = outputFeed.title;
    title = filterControlCharacters(title);
    title = replaceHTML(title, '');
    title = title.replace(/\s+/, ' ');
    const titleMaxLength = 1024;
    title = truncateHTML(title, titleMaxLength, '');
    outputFeed.title = title;
  }

  if(outputFeed.description) {
    let description = outputFeed.description;
    description = filterControlCharacters(description);
    description = replaceHTML(description, '');
    description = description.replace(/\s+/, ' ');
    const beforeLength = description.length;
    const descriptionMaxLength = 1024 * 10;
    description = truncateHTML(description, descriptionMaxLength, '');

    if(beforeLength > description.length) {
      // console.warn('Truncated description', description);
    }

    outputFeed.description = description;
  }

  return outputFeed;
}

// Returns a new object that results from merging the old feed with the new
// feed. Fields from the new feed take precedence, except for URLs, which are
// merged to generate a distinct ordered set of oldest to newest url. Impure
// because of copying by reference.
function mergeFeeds(oldFeedObject, newFeedObject) {
  const mergedFeedObject = Object.assign({}, oldFeedObject, newFeedObject);
  mergedFeedObject.urls = [...oldFeedObject.urls];

  if(newFeedObject.urls) {
    for(let urlString of newFeedObject.urls) {
      addFeedURLString(mergedFeedObject, urlString);
    }
  } else {
    console.warn('Did not merge any new feed urls', oldFeedObject, newFeedObject);
  }

  return mergedFeedObject;
}

// Get the last url in an entry's internal url list
function getEntryURLString(entry) {
  // Allow the natural error to happen if urls is not an array
  if(!entry.urls.length) {
    throw new TypeError('Entry object has no urls');
  }

  return entry.urls[entry.urls.length - 1];
}

// Append a url to the entry's internal url list. Lazily creates the list if
// need. Also normalizes the url. Returns false if the url already exists and
// was not added
function addEntryURLString(entry, urlString) {
  const normalizedURLObject = new URL(urlString);
  if(entry.urls) {
    if(entry.urls.includes(normalizedURLObject.href)) {
      return false;
    }
    entry.urls.push(normalizedURLObject.href);
  } else {
    entry.urls = [normalizedURLObject.href];
  }

  return true;
}

// Returns a new entry object where fields have been sanitized. Impure
// TODO: ensure dates are not in the future, and not too old? Should this be
// a separate function like validateEntry?
function sanitizeEntry(inputentry, options) {

  const condenseWhitespace = function(string) {
    return string.replace(/\s{2,}/g, ' ');
  };

  options = options || {};
  const authorMaxLength = options.authorMaxLength || 200;
  const titleMaxLength = options.titleMaxLength || 1000;
  const contentMaxLength = options.contentMaxLength || 50000;

  const outputEntry = Object.assign({}, inputentry);

  if(outputEntry.author) {
    let author = outputEntry.author;
    author = filterControlCharacters(author);
    author = replaceHTML(author, '');
    author = condenseWhitespace(author);
    author = truncateHTML(author, authorMaxLength);
    outputEntry.author = author;
  }

  // Condensing node whitespace is handled separately
  // TODO: filter out non-printable characters other than \r\n\t
  if(outputEntry.content) {
    let content = outputEntry.content;
    content = truncateHTML(content, contentMaxLength);
    outputEntry.content = content;
  }

  if(outputEntry.title) {
    let title = outputEntry.title;
    title = filterControlCharacters(title);
    title = replaceHTML(title, '');
    title = condenseWhitespace(title);
    title = truncateHTML(title, titleMaxLength);
    outputEntry.title = title;
  }

  return outputEntry;
}
