'use strict';

// import base/assert.js
// import base/number.js
// import base/string.js
// import net/url-utils.js
// import favicon.js
// import html.js

function feedCreate() {
  return {};
}

function feedIsFeed(feed) {
  return typeof feed === 'object';
}

function feedIsValidId(id) {
  return numberIsPositiveInteger(id);
}

function feedHasURL(feed) {
  assert(feedIsFeed(feed));
  return feed.urls && feed.urls.length;
}

// Returns the last url in the feed's url list as a string
// @param feed {Object} a feed object
// @returns {String} the last url in the feed's url list
function feedGetTopURL(feed) {
  assert(feed && feed.urls && feed.urls.length);
  return feed.urls[feed.urls.length - 1];
}

// Appends a url to the feed's internal list. Lazily creates the list if needed
// @param feed {Object} a feed object
// @param urlString {String}
function feedAppendURL(feed, urlString) {
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
function feedCreateIconLookupURL(feed) {
  assert(feedIsFeed(feed));

  // First, prefer the link, as this is the url of the webpage that is
  // associated with the feed. Cannot assume the link is set or valid
  if(feed.link) {
    // If feed.link is set it should always be canonical
    assert(URLUtils.isCanonical(feed.link));
    try {
      return new URL(feed.link);
    } catch(error) {
      // If feed.link is set it should always be valid
      console.warn(error);
    }
  }

  // If the link is missing or invalid then use the origin of the feed's
  // xml url. Assume the feed always has a url.
  const urlString = feedGetTopURL(feed);
  const urlObject = new URL(urlString);
  return new URL(urlObject.origin);
}

// Update's a feed's faviconURLString property (not persisted to db)
async function feedUpdateFavicon(feed, iconConn) {

  const query = new FaviconQuery();
  query.conn = iconConn;
  query.url = feedCreateIconLookupURL(feed);

  let icon_url;
  try {
    icon_url = await faviconLookup(query);
  } catch(error) {
    console.warn(error);
    // TODO: use a more accurate error code
    return RDR_ERR_DB;
  }

  feed.faviconURLString = icon_url;
  return RDR_OK;
}

// TODO: include this in places where sanitize is called
// TODO: assert required properties are present
// TODO: assert type, if set, is one of the valid types
// TODO: assert feed has one or more urls
// TODO: assert the type of each property?
function feedHasValidProperties(feed) {
  assert(feedIsFeed(feed));

  if('id' in feed) {
    if(!numberIsPositiveInteger(feed.id)) {
      return false;
    }
  }

  if('type' in feed) {
    const types = ['feed', 'rss', 'rdf'];
    assert(types.includes(feed.type));
  }

  return true;
}

// Returns a shallow copy of the input feed with sanitized properties
function feedSanitize(feed, titleMaxLength, descMaxLength) {
  assert(feedIsFeed(feed));

  const DEFAULT_TITLE_MAX_LEN = 1024;
  const DEFAULT_DESC_MAX_LEN = 1024 * 10;

  if(typeof titleMaxLength === 'undefined') {
    titleMaxLength = DEFAULT_TITLE_MAX_LEN;
  } else {
    assert(numberIsPositiveInteger(titleMaxLength));
  }

  if(typeof descMaxLength === 'undefined') {
    descMaxLength = DEFAULT_DESC_MAX_LEN;
  } else {
    assert(numberIsPositiveInteger(descMaxLength));
  }

  const outputFeed = Object.assign({}, feed);
  const tagReplacement = '';
  const suffix = '';

  if(outputFeed.title) {
    let title = outputFeed.title;
    title = stringFilterControlChars(title);
    title = htmlReplaceTags(title, tagReplacement);
    title = stringCondenseWhitespace(title);
    title = htmlTruncate(title, titleMaxLength, suffix);
    outputFeed.title = title;
  }

  if(outputFeed.description) {
    let desc = outputFeed.description;
    desc = stringFilterControlChars(desc);
    desc = htmlReplaceTags(desc, tagReplacement);
    desc = stringCondenseWhitespace(desc);
    desc = htmlTruncate(desc, descMaxLength, suffix);
    outputFeed.description = desc;
  }

  return outputFeed;
}

// Returns a new object that results from merging the old feed with the new
// feed. Fields from the new feed take precedence, except for urls, which are
// merged to generate a distinct ordered set of oldest to newest url. Impure
// because of copying by reference.
function feedMerge(oldFeed, newFeed) {
  const mergedFeed = Object.assign(feedCreate(), oldFeed, newFeed);

  // After assignment, the merged feed has only the urls from the new feed.
  // So the output feed's url list needs to be fixed. First copy over the old
  // feed's urls, then try and append each new feed url.
  mergedFeed.urls = [...oldFeed.urls];

  if(newFeed.urls) {
    for(const urlString of newFeed.urls) {
      feedAppendURL(mergedFeed, urlString);
    }
  }

  return mergedFeed;
}
