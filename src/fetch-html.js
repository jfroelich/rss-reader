// See license.md

'use strict';

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

  let responseObject;

  // If a timeout is given then race a timeout promise against the fetch. This
  // is done this way because fetch does not currently have native timeout
  // functionality.
  if(timeoutMillis) {

    const timeoutPromise = new Promise(function(resolve, reject) {
      const error = new Error(`Request timed out ${urlString}`);
      setTimeout(reject, timeoutMillis, error);
    });
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

  // Verify that the response content type is one of the allowed content types
  let typeString = responseObject.headers.get('Content-Type');
  if(typeString) {
    // Discard the semicolon and trailing text portion
    const semicolonPosition = typeString.indexOf(';');
    if(semicolonPosition !== -1) {
      typeString = typeString.substring(0, semicolonPosition);
    }

    // Normalize the type string
    // Remove all whitespace
    typeString = typeString.replace(/\s+/g, '');
    typeString = typeString.toLowerCase();
    const acceptedTypesArray = ['text/html'];

    if(!acceptedTypesArray.includes(typeString)) {
      throw new Error(
        `Unacceptable content type ${type} ${responseObject.url}`);
    }
  }

  const responseText = await responseObject.text();

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
