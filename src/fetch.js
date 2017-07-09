// See license.md

'use strict';

// TODO: break up into invidiual libs, remove all coupling, remove all
// knowledge of formatting, like fetchFeed just cares about fetching a
// feed it does not know how it will be used or stored

// It is perfectly fine to have repetitive code here for these fetching fns

async function fetchFeed(urlString, timeoutMillis) {

  // For validating the response mime type
  const acceptedTypesArray = [
    'application/rss+xml',
    'application/rdf+xml',
    'application/atom+xml',
    'application/xml',
    'text/xml',
    'text/html'
  ];

  // Sent as a part of the http request header
  const acceptHeaderString = [
    'application/rss+xml',
    'application/rdf+xml',
    'application/atom+xml',
    'application/xml;q=0.9',
    'text/xml;q=0.8'
  ].join(',');

  const fetchOptionsObject = {
    'credentials': 'omit',
    'method': 'get',
    'headers': {'Accept': acceptHeaderString},
    'mode': 'cors',
    'cache': 'default',
    'redirect': 'follow',
    'referrer': 'no-referrer'
  };

  const responseObject = await jrFetch(urlString, fetchOptionsObject,
    acceptedTypesArray, timeoutMillis);
  const responseText = await responseObject.text();
  const parsedFeed = parseFeed(responseText);

  // TODO: all of this post fetch processing does not belong here. Even though
  // this always happens when fetching a feed, it is not intrinsic to fetching

  // Furthermore, the feed format should not matter. This just downloads its
  // own type of object that the caller is responsible for manipulating and
  // coercing into a known format

  const entries = parsedFeed.entries;
  const feedObject = parsedFeed;
  delete feedObject.entries;

  // Supply a default date for the feed
  if(!feedObject.datePublished) {
    feedObject.datePublished = new Date();
  }

  // Normalize the feed's link value
  if(feedObject.link) {
    try {
      feedObject.link = new URL(feedObject.link).href;
    } catch(error) {
      console.warn(error);
      delete feedObject.link;
    }
  }

  // Suppy a default date for entries
  entries.filter((e)=> !e.datePublished).forEach((e) =>
    e.datePublished = feedObject.datePublished);

  // Convert entry.link into entry.urls array
  entries.forEach((e) => {
    if(!e.link) return;
    entry.addURLString(e, e.link);
    delete e.link;
  });

  feed.addURLString(feedObject, urlString);
  feed.addURLString(feedObject, responseObject.url);
  feedObject.dateFetched = new Date();
  feedObject.dateLastModified = getLastModified(responseObject);
  return {'feed': feedObject, 'entries': entries};


  function getLastModified(responseObject) {
    const lastModifiedString = responseObject.headers.get('Last-Modified');
    if(!lastModifiedString) {
      return;
    }

    let lastModifiedDate;
    try {
      lastModifiedDate = new Date(lastModifiedString);
    } catch(error) {
    }
    return lastModifedDate;
  }

}

async function jrFetchHTML(urlString, timeoutMillis) {

  const acceptedTypesArray = ['text/html'];

  const fetchOptionsObject = {
    'credentials': 'omit',
    'method': 'get',
    'headers': {'Accept': acceptedTypesArray.join('')},
    'mode': 'cors',
    'cache': 'default',
    'redirect': 'follow',
    'referrer': 'no-referrer'
  };

  const responseObject = await jrFetch(urlString, fetchOptionsObject,
    acceptedTypesArray, timeoutMillis);
  const responseText = await responseObject.text();

  // Intentionally not catching parse exceptions
  const parser = new DOMParser();
  const documentObject = parser.parseFromString(responseText, 'text/html');

  // TODO: because I renamed these I need to check all call sites that
  // destructure and verify proper variable names
  const resultObject = {
    'documentObject': documentObject,
    'responseURLString': responseObject.url
  };

  return resultObject;
}

// Asynchronously fetches the response for the given url
// @param urlString {String} the url to fetch
// @param fetchOptionsObject {Object} optional, second parameter to fetch call
// @param typeArray {Array} optional, array of strings of acceptable response
// mime types (not including character set), if specified then the response
// type is validated and if invalid an exception is thrown
// @param timeoutMillis {Number} optional, integer, if specified then the
// request will timeout after the given number of milliseconds elapsed, if this
// occurs then an exception is thrown
async function jrFetch(urlString, fetchOptionsObject, typeArray,
  timeoutMillis) {

  const fetchPromise = fetch(urlString, fetchOptionsObject);

  let responseObject;

  // If a timeout is given then race a timeout promise against the fetch. This
  // is done this way because fetch does not currently have native timeout
  // functionality.
  if(timeoutMillis) {

    const timeoutPromise = jrFetchWithTimeout(urlString, timeoutMillis);
    const promiseArray = [fetchPromise, timeoutPromise];

    // If the timeout wins this throws an exception, which is intentionally
    // not caught. Similarly the fetch may fail and throw an exception.
    responseObject = await Promise.race(promiseArray);
  } else {
    responseObject = await fetchPromise;
  }

  // Throw an exception for a non-ok response
  if(!responseObject.ok) {
    throw new Error(
      `${responseObject.status} ${responseObject.statusText} ${urlString}`);
  }

  // Throw an exception in the case of a no-content response
  const httpStatusNoContent = 204;
  if(responseObject.status === httpStatusNoContent) {
    throw new Error(
      `${responseObject.status} ${responseObject.statusText} ${urlString}`);
  }

  // If an array of content types was specified, then verify that the response
  // content type is one of the allowed content types, and throw an exception
  // if not valid
  if(typeArray) {
    const typeString = getMimeType(responseObject);
    if(!typeArray.includes(typeString)) {
      throw new Error(
        `Unacceptable content type ${type} ${responseObject.url}`);
    }
  }

  return responseObject;

  function jrFetchWithTimeout(urlString, timeoutMillis) {
    return new Promise((resolve, reject) => {
      const error = new Error(`Request timed out ${urlString}`);
      setTimeout(reject, timeoutMillis, error);
    });
  }

  function getMimeType(responseObject) {
    let typeString = responseObject.headers.get('Content-Type');
    if(!typeString) {
      return;
    }

    // Discard the semicolon and trailing text portion
    const semicolonPosition = typeString.indexOf(';');
    if(semicolonPosition !== -1) {
      typeString = typeString.substring(0, semicolonPosition);
    }

    // Remove all whitespace
    typeString = typeString.replace(/\s+/g, '');
    typeString = typeString.toLowerCase();
    return typeString;
  }
}
