// See license.md

'use strict';

// Dependencies:
// parseFeed
// feed (for the moment)

// TODO: remove all dependence on feed lib
// TODO: all of this post fetch processing does not belong here. Even though
// this always happens when fetching a feed, it is not intrinsic to fetching
// Furthermore, the feed format should not matter. This just downloads its
// own type of object that the caller is responsible for manipulating and
// coercing into a known format


async function fetchFeed(urlString, timeoutMillis) {

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

  const fetchPromise = fetch(urlString, fetchOptionsObject);
  let responseObject;

  // If a timeout is given then race a timeout promise against the fetch. This
  // is done this way because fetch does not currently have native timeout
  // functionality. If the timeout wins this throws an exception, which is
  // intentionally not caught.
  if(timeoutMillis) {
    const timeoutPromise = new Promise(function(resolve, reject) {
      const timeoutError = new Error('Fetch timed out for url ' + urlString);
      setTimeout(reject, timeoutMillis, timeoutError);
    });

    const promiseArray = [fetchPromise, timeoutPromise];
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

  // Throw an exception is the response type is not accepted
  let typeString = responseObject.headers.get('Content-Type');
  if(typeString) {
    // Discard the semicolon and trailing text
    const semicolonPosition = typeString.indexOf(';');
    if(semicolonPosition !== -1) {
      typeString = typeString.substring(0, semicolonPosition);
    }

    // Normalize the type string
    typeString = typeString.replace(/\s+/g, '');
    typeString = typeString.trim();
    typeString = typeString.toLowerCase();

    const acceptedTypesArray = [
      'application/rss+xml',
      'application/rdf+xml',
      'application/atom+xml',
      'application/xml',
      'text/xml',
      'text/html'
    ];

    if(!acceptedTypesArray.includes(typeString)) {
      throw new Error(
        `Unacceptable content type ${typeString} ${urlString}`);
    }
  }

  const responseText = await responseObject.text();

  // Allow parseFeed exceptions to bubble

  let feedObject = parseFeed(responseText);


  // TODO: should just return feedObject at this point, along with
  // fetch properties.
  // TODO: move into function acclimateFeed


  const entries = feedObject.entries;
  delete feedObject.entries;

  // Supply a default date for the feed
  if(!feedObject.datePublished) {
    feedObject.datePublished = new Date();
  }

  // Normalize the feed's link value. Not fatal if link invalid.
  if(feedObject.link) {
    try {
      feedObject.link = new URL(feedObject.link).href;
    } catch(error) {
      // console.warn(error);
      delete feedObject.link;
    }
  }

  // Suppy a default date for entries
  for(let entry of entries) {
    if(!entry.datePublished) {
      entry.datePublished = feedObject.datePublished;
    }
  }

  // Convert entry link urls
  for(let entry of entries) {
    if(entry.link) {
      entry.addURLString(entry, entry.link);
      delete entry.link;
    }
  }

  feed.addURLString(feedObject, urlString);

  // Add the response url, which may be different
  feed.addURLString(feedObject, responseObject.url);

  feedObject.dateFetched = new Date();

  const lastModifiedString = responseObject.headers.get('Last-Modified');
  if(lastModifiedString) {
    let lastModifiedDate;
    try {
      lastModifiedDate = new Date(lastModifiedString);
    } catch(error) {
    }

    if(lastModifiedDate) {
      feedObject.dateLastModified = lastModifiedDate;
    }
  }

  const fetchResultObject = {};
  fetchResultObject.feed = feedObject;
  fetchResultObject.entries = entries;
  return fetchResultObject;
}
