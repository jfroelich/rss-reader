// See license.md

'use strict';

{ // Begin file block scope

async function fetchFeed(urlString, timeoutMillis, acceptHTML) {
  if(typeof timeoutMillis === 'undefined') {
    timeoutMillis = 0;
  }

  if(typeof acceptHTML === 'undefined') {
    acceptHTML = true;
  }

  const acceptHeader = [
    'application/rss+xml',
    'application/rdf+xml',
    'application/atom+xml',
    'application/xml;q=0.9',
    'text/xml;q=0.8'
  ].join(',');

  const headers = {'Accept': acceptHeader};

  const fetchOptions = {
    'credentials': 'omit',
    'method': 'get',
    'headers': headers,
    'mode': 'cors',
    'cache': 'default',
    'redirect': 'follow',
    'referrer': 'no-referrer',
    'referrerPolicy': 'no-referrer'
  };

  const fetchPromise = fetch(urlString, fetchOptions);
  let response;
  if(timeoutMillis) {
    const timeoutPromise = fetchTimeout(urlString, timeoutMillis);
    const promises = [fetchPromise, timeoutPromise];
    response = await Promise.race(promises);
  } else {
    response = await fetchPromise;
  }

  assertValidResponse(response, urlString);
  assertValidContentType(response, urlString, acceptHTML);

  const outputResponse = {};
  outputResponse.text = await response.text();
  outputResponse.requestURLString = urlString;
  outputResponse.responseURLString = response.url;
  outputResponse.lastModifiedDate = getLastModifiedDate(response);
  outputResponse.redirected = checkIfRedirected(urlString, response.url);
  return outputResponse;
}

this.fetchFeed = fetchFeed;

function fetchTimeout(urlString, timeoutMillis) {
  return new Promise(function(resolve, reject) {
    const error = new Error('Fetch timed out for url ' + urlString);
    setTimeout(reject, timeoutMillis, error);
  });
}

function assertValidResponse(response, urlString) {
  if(!response) {
    throw new Error('Undefined response fetching ' + urlString);
  }

  if(!response.ok) {
    throw new Error(`${response.status} ${response.statusText} ${urlString}`);
  }

  const httpStatusNoContent = 204;
  if(response.status === httpStatusNoContent) {
    throw new Error(`${response.status} ${response.statusText} ${urlString}`);
  }
}

// Throw an exception is the response type is not accepted
function assertValidContentType(response, urlString, acceptHTML) {
  let typeString = response.headers.get('Content-Type');
  if(!typeString) {
    return;
  }

  const semicolonPosition = typeString.indexOf(';');
  if(semicolonPosition !== -1) {
    typeString = typeString.substring(0, semicolonPosition);
  }

  typeString = typeString.replace(/\s+/g, '');
  typeString = typeString.toLowerCase();

  const types = [
    'application/rss+xml',
    'application/rdf+xml',
    'application/atom+xml',
    'application/xml',
    'text/xml'
  ];

  if(acceptHTML) {
    types.push('text/html');
  }

  if(!types.includes(typeString)) {
    throw new Error(`Unacceptable content type ${typeString} ${urlString}`);
  }
}

function getLastModifiedDate(response) {
  const lastModifiedString = response.headers.get('Last-Modified');
  if(lastModifiedString) {
    try {
      return new Date(lastModifiedString);
    } catch(error) {
    }
  }
}

// Due to quirks with fetch response.redirected not working, do a basic test
// here
function checkIfRedirected(requestURLString, responseURLString) {
  if(requestURLString === responseURLString) {
    return false;
  }

  const requestURLObject = new URL(requestURLString);
  const responseURLObject = new URL(responseURLString);
  requestURLObject.hash = '';
  responseURLObject.hash = '';
  return requestURLObject.href !== responseURLObject.href;
}

} // End file block scope
