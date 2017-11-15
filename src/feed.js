// Utilities for working with app feeds

import assert from "/src/assert.js";
import {replaceTags, truncate as htmlTruncate} from "/src/html.js";
import {isPosInt} from "/src/number.js";
import {condenseWhitespace, filterControls} from "/src/string.js";
import {isCanonicalURLString} from "/src/url-string.js";

export function create() {
  return {};
}

export function isFeed(feed) {
  return typeof feed === 'object';
}

export const isValidId = isPosInt;

export function hasURL(feed) {
  assert(isFeed(feed));
  return feed.urls && feed.urls.length;
}

// Returns the last url in the feed's url list as a string
// @param feed {Object} a feed object
// @returns {String} the last url in the feed's url list
export function peekURL(feed) {
  assert(feed && feed.urls && feed.urls.length);
  return feed.urls[feed.urls.length - 1];
}

// Appends a url to the feed's internal list. Lazily creates the list if needed
// @param feed {Object} a feed object
// @param urlString {String}
export function appendURL(feed, urlString) {
  feed.urls = feed.urls || [];
  const urlObject = new URL(urlString);
  const normalURLString = urlObject.href;
  if(feed.urls.includes(normalURLString)) {
    return false;
  }

  feed.urls.push(normalURLString);
  return true;
}

// Returns the url used to lookup a feed's favicon
// @returns {URL}
export function createIconLookupURL(feed) {
  assert(isFeed(feed));

  // First, prefer the link, as this is the url of the webpage that is associated with the feed.
  // Cannot assume the link is set or valid. But if set, can assume it is valid.
  if(feed.link) {
    assert(isCanonicalURLString(feed.link));
    try {
      return new URL(feed.link);
    } catch(error) {
      // If feed.link is set it should always be a valid URL
      console.warn(error);
    }
  }

  // If the link is missing or invalid then use the origin of the feed's xml url. Assume the feed
  // always has a url.
  const urlString = peekURL(feed);
  const urlObject = new URL(urlString);
  return new URL(urlObject.origin);
}


// This is experimental and not in use so not exported
// TODO: include this in places where sanitize is called
// TODO: assert required properties are present
// TODO: assert type, if set, is one of the valid types
// TODO: assert feed has one or more urls
// TODO: assert the type of each property?
function isValid(feed) {
  assert(isFeed(feed));

  if('id' in feed) {
    if(!isPosInt(feed.id)) {
      return false;
    }
  }

  if('type' in feed) {
    const types = ['feed', 'rss', 'rdf'];
    assert(types.includes(feed.type));
  }

  return true;
}

// TODO: move to reader-storage.js
// Returns a shallow copy of the input feed with sanitized properties
export function sanitize(feed, titleMaxLength, descMaxLength) {
  assert(isFeed(feed));

  const DEFAULT_TITLE_MAX_LEN = 1024;
  const DEFAULT_DESC_MAX_LEN = 1024 * 10;

  if(typeof titleMaxLength === 'undefined') {
    titleMaxLength = DEFAULT_TITLE_MAX_LEN;
  } else {
    assert(isPosInt(titleMaxLength));
  }

  if(typeof descMaxLength === 'undefined') {
    descMaxLength = DEFAULT_DESC_MAX_LEN;
  } else {
    assert(isPosInt(descMaxLength));
  }

  const outputFeed = Object.assign({}, feed);
  const tagReplacement = '';
  const suffix = '';

  if(outputFeed.title) {
    let title = outputFeed.title;
    title = filterControls(title);
    title = replaceTags(title, tagReplacement);
    title = condenseWhitespace(title);
    title = htmlTruncate(title, titleMaxLength, suffix);
    outputFeed.title = title;
  }

  if(outputFeed.description) {
    let desc = outputFeed.description;
    desc = filterControls(desc);
    desc = replaceTags(desc, tagReplacement);
    desc = condenseWhitespace(desc);
    desc = htmlTruncate(desc, descMaxLength, suffix);
    outputFeed.description = desc;
  }

  return outputFeed;
}

// Returns a new object that results from merging the old feed with the new feed. Fields from the
// new feed take precedence, except for urls, which are merged to generate a distinct ordered set of
// oldest to newest url. Impure because of copying by reference.
export function merge(oldFeed, newFeed) {
  const mergedFeed = Object.assign(create(), oldFeed, newFeed);

  // After assignment, the merged feed has only the urls from the new feed. So the output feed's url
  // list needs to be fixed. First copy over the old feed's urls, then try and append each new feed
  // url.
  mergedFeed.urls = [...oldFeed.urls];

  if(newFeed.urls) {
    for(const urlString of newFeed.urls) {
      appendURL(mergedFeed, urlString);
    }
  }

  return mergedFeed;
}
