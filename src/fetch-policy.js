
import assert from "/src/assert.js";
import {isCanonicalURLString} from "/src/url-string.js";

// NOTE: this is the initial implementation, probably going to change drastically, is definitely
// not very reliable or accurate
// NOTE: some of the tests are easily defeated, but I am simply implementing something for now, as
// a proof of concept
// TODO: allow preference override through localStorage setting

// Return true if the app's policy permits fetching the url
// TODO: accept URL object instead of string
export default function isAllowedURL(url) {
  assert(isCanonicalURLString(url));
  const urlo = new URL(url);
  return !urlHasCredentials(urlo) && !isLocalURL(urlo);
}

// TODO: move to url.js?
function urlHasCredentials(url) {
  return url.username || url.password;
}

// TODO: move to url.js?
function isLocalURL(url) {
  const protocol = url.protocol;
  const hostname = url.hostname;
  return hostname === 'localhost' || hostname === '127.0.0.1' || protocol === 'file:';
}
