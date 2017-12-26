import {fetchInternal} from "/src/fetch/utils.js";

// TODO: this is now so simple it should maybe just be inlined

// Fetches the html content of the given url
// @param url {URL} request url
// @param timeoutMs {Number} optional, in milliseconds, how long to wait before considering the
// fetch to be a failure.
export default function fetchHTML(url, timeoutMs) {
  const options = {
    timeout: timeoutMs
  };

  const acceptedMimeTypes = ['text/html'];
  return fetchInternal(url, options, acceptedMimeTypes);
}
