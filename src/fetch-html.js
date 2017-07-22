// See license.md

'use strict';

{ // Begin file block scope

async function fetchHTML(urlString, timeoutMillis) {

  const options = {
    'credentials': 'omit',
    'method': 'get',
    'headers': {'Accept': 'text/html'},
    'mode': 'cors',
    'cache': 'default',
    'redirect': 'follow',
    'referrer': 'no-referrer'
  };

  const fetchPromise = fetch(urlString, options);
  let response;
  if(timeoutMillis) {
    const timeoutPromise = rejectAfterTimeout(urlString, timeoutMillis);
    const promises = [fetchPromise, timeoutPromise];
    response = await Promise.race(promises);
  } else {
    response = await fetchPromise;
  }

  validateResponse(response, urlString);
  validateContentType(response, urlString);

  const outputResponse = {};
  outputResponse.redirected = checkIfRedirected(urlString, response.url);
  const responseText = await response.text();
  const parser = new DOMParser();
  const documentObject = parser.parseFromString(responseText, 'text/html');
  outputResponse.documentObject = documentObject,
  outputResponse.responseURLString = response.url;
  return outputResponse;
}

this.fetchHTML = fetchHTML;

function rejectAfterTimeout(urlString, timeoutMillis) {
  return new Promise(function(resolve, reject) {
    const error = new Error(`Request timed out ${urlString}`);
    setTimeout(reject, timeoutMillis, error);
  });
}

function validateResponse(response, urlString) {
  if(!response) {
    throw new Error(`${response.status} ${response.statusText} ${urlString}`);
  }

  // Throw an exception for a non-ok response
  if(!response.ok) {
    throw new Error(`${response.status} ${response.statusText} ${urlString}`);
  }

  // Throw an exception in the case of a no-content response
  const httpStatusNoContent = 204;
  if(response.status === httpStatusNoContent) {
    throw new Error(
      `${response.status} ${response.statusText} ${urlString}`);
  }
}

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

function validateContentType(response, urlString) {
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
  const acceptedTypes = ['text/html'];
  if(!acceptedTypes.includes(typeString)) {
    throw new Error(`Unacceptable content type ${typeString} ${urlString}`);
  }
}

} // End file block scope
