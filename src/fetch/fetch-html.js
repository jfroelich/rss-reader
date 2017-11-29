import {fetchInternal} from "/src/fetch/utils.js";
import * as mime from "/src/utils/mime-utils.js";

// Fetches the html content of the given url
// @param url {String} the url to fetch
// @param timeoutMs {Number} optional, timeout in milliseconds
export default function fetchHTML(url, timeoutMs) {
  const options = {
    credentials: 'omit',
    method: 'get',
    headers: {'Accept': mime.MIME_TYPE_HTML},
    mode: 'cors',
    cache: 'default',
    redirect: 'follow',
    referrer: 'no-referrer',
    referrerPolicy: 'no-referrer'
  };

  function acceptHTMLPredicate(response) {
    // NOTE: apparently headers.get can return null when the header is not present. I finally
    // witnessed this event and it caused an assertion error in fromContentType. I modified
    // fromContentType to tolerate nulls so the assertion error no longer occurs. I should probably
    // revisit the documentation on response.headers.get because my belief is this is either
    // undocumented or perhaps some subtle behavior was changed in Chrome. It seems odd that this
    // is the first time ever seeing a request without a Content-Type header.

    const contentType = response.headers.get('Content-Type');
    const mimeType = mime.fromContentType(contentType);
    return mimeType === mime.MIME_TYPE_HTML;
  }
  return fetchInternal(url, options, timeoutMs, acceptHTMLPredicate);
}
