import {fetchInternal} from "/src/fetch/utils.js";
import * as mime from "/src/utils/mime-utils.js";

// TODO: change to expect url to be URL object instead of String

// Fetches the html content of the given url
// @param url {String} the url to fetch
// @param timeoutMs {Number} optional, timeout in milliseconds
export default function fetchHTML(url, timeoutMs) {

  const requestURLObject = new URL(url);

  // NOTE: some websites appear to require a fallback */* otherwise a 406 not acceptable response
  // status code is returned as a result of GET. For a reproducible test case, use the url
  // http://daringfireball.net/linked/2016/10/31/intel-mbp-ram. By appending the fallback of */*
  // with a lower priority (that is the "q" below), I no longer get a 406. I do not really have an
  // explanation for this behavior nor do I fully understand it. But it is now working.
  // There is that principle of accepting garbage as input on the web, I forget the name of it, this
  // is probably an example of that. This one Apache server has a distinctive configuration that
  // is causing this behavior. Added */* fixed issue #271.

  const acceptHeaderValue = [
    mime.MIME_TYPE_HTML,
    '*/*;q=0.9'
  ].join(',');

  const options = {
    credentials: 'omit',
    method: 'get',
    headers: {accept: acceptHeaderValue},
    mode: 'cors',
    cache: 'default',
    redirect: 'follow',
    referrer: 'no-referrer',
    referrerPolicy: 'no-referrer'
  };

  const acceptedMimeTypes = [mime.MIME_TYPE_HTML];
  return fetchInternal(requestURLObject, options, timeoutMs, acceptedMimeTypes);
}
