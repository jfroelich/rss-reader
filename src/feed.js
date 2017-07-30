// See license.md

'use strict';

// Utility functions related to working with feeds and entries
function Feed() {}

// Get the url currently representing the feed, which is the final url in its
// internal urls array.
// @returns {String}
Feed.prototype.getURL = function() {
  const urls = this.urls;
  if(!urls.length) {
    throw new Error('feed.urls is invalid');
  }

  return urls[urls.length - 1];
};

// Add a new url to the feed. Lazily creates the urls property.
// @param urlString {String}
Feed.prototype.addURL = function(urlString) {
  this.urls = this.urls || [];
  const urlObject = new URL(urlString);
  const normalizedURLString = urlObject.href;
  if(this.urls.includes(normalizedURLString)) {
    return false;
  }
  this.urls.push(normalizedURLString);
  return true;
};

// Creates a url object that can be used as input to lookupFavicon
// @returns {URL}
Feed.prototype.createIconLookupURL = function() {
  // Cannot assume the link is set nor valid
  if(this.link) {
    try {
      return new URL(this.link);
    } catch(error) {
      console.warn(error);
    }
  }

  // If the link is missing or invalid then use the origin
  // Assume the feed always has a url.
  // Due to expected custom 'this' binding use call, because getURL may not
  // exist on 'this' as a function
  const urlString = Feed.prototype.getURL.call(this);
  const urlObject = new URL(urlString);
  const originString = urlObject.origin;
  return new URL(originString);
};

// Returns a shallow copy of the input feed with sanitized properties
// TODO: sanitize is not same as validate, this should not validate, this is
// a conflation of functionality
Feed.prototype.sanitize = function() {
  const outputFeed = Object.assign({}, this);

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
};

// Returns a new object that results from merging the old feed with the new
// feed. Fields from the new feed take precedence, except for URLs, which are
// merged to generate a distinct ordered set of oldest to newest url. Impure
// because of copying by reference.
function mergeFeeds(oldFeedObject, newFeedObject) {
  const mergedFeedObject = Object.assign({}, oldFeedObject, newFeedObject);
  mergedFeedObject.urls = [...oldFeedObject.urls];

  if(newFeedObject.urls) {
    for(let urlString of newFeedObject.urls) {
      Feed.prototype.addURL.call(mergedFeedObject, urlString);
    }
  } else {
    console.warn('Did not merge any new feed urls', oldFeedObject, newFeedObject);
  }

  return mergedFeedObject;
}

const ENTRY_STATE_UNREAD = 0;
const ENTRY_STATE_READ = 1;
const ENTRY_STATE_UNARCHIVED = 0;
const ENTRY_STATE_ARCHIVED = 1;

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

// Throws an exception if 'this' feed is not suitable for storage. The
// objective is to prevent garbage data from entering the database.
// @param minDate {Date} optional, the oldest date allowed for date properties,
// defaults to Jan 1, 1970.
// NOTE: not fully implemented
// NOTE: only validating date objects, not fully validating actual dates such
// as if day of month > 31 or whatever
// TODO: assert required properties are present
// TODO: assert dates are not in the future
// TODO: assert dates are not too far in the past
// TODO: assert type, if set, is one of the valid types
// TODO: assert feed has one or more urls
// TODO: assert the type of each property?
// TODO: add to appropriate calling contexts (e.g. whereever prep for storage
// is done).
Feed.prototype.assertValidity = function(minDate, requireId) {
  const defaultMinDate = new Date(0);
  const toString = Object.prototype.toString;
  const maxDate = new Date();

  // minDate is optional
  if(typeof minDate === 'undefined') {
    minDate = defaultMinDate;
  }

  // Validate the minDate parameter itself before using it
  if(toString.call(minDate) !== '[object Date]') {
    throw new TypeError('minDate is not a date object: ' + minDate);
  } else if(isNaN(minDate.getTime())) {
    throw new TypeError('minDate.getTime() is nan: ' + minDate);
  } else if(minDate < defaultMinDate) {
    throw new TypeError('minDate is too old: ' + minDate);
  } else if(minDate > maxDate) {
    throw new TypeError('minDate > maxDate: ' + minDate);
  }

  if(typeof this !== 'object') {
    throw new Error('this is not an object: ' + this);
  }

  // this.id is optional because it does not exist when adding a feed to the
  // datababse.
  if('id' in this) {
    if(isNan(this.id)) {
      throw new Error('id is not a number: ' + this.id);
    } else if(id < 0) {
      throw new Error('id is negative: ' + this.id);
    } else if(!Number.isInteger(id)) {
      throw new Error('id is not an integer: ' + this.id);
    }
  } else if(requireId) {
    throw new Error('feed missing required id: ' + this);
  }


  // TODO: unsure whether this is even a property at the moment, just
  // wondering about how the validation would look
  if('dateUpdated' in this) {
    if(toString.call(this.dateUpdated) !== '[object Date]') {
      throw new Error('dateUpdated is not a date object: ' + this.dateUpdated);
    } else if(isNaN(this.dateUpdated.getTime())) {
      throw new Error('dateUpdated.getTime() is nan: ' + this.dateUpdated);
    } else if(this.dateUpdated < minDate) {
      throw new Error('dateUpdated < minDate: ' + this.dateUpdated);
    } else if(this.dateUpdated > maxDate) {
      throw new Error('dateUpdated > maxDate: ' + this.dateUpdated);
    }
  }

};


// Returns a new entry object where fields have been sanitized. Impure
function sanitizeEntry(inputentry, authorMaxLength, titleMaxLength,
  contentMaxLength) {
  function condenseWhitespace(string) {
    return string.replace(/\s{2,}/g, ' ');
  }

  if(typeof authorMaxLength === 'undefined') {
    authorMaxLength = 200;
  }
  if(typeof titleMaxLength === 'undefined') {
    titleMaxLength = 1000;
  }
  if(typeof contentMaxLength === 'undefined') {
    contentMaxLength = 50000;
  }

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
