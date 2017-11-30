import assert from "/src/assert/assert.js";
import {isCredentialedURL} from "/src/url/url.js";

// NOTE: this is the initial implementation, probably going to change drastically, is definitely
// not very reliable or accurate. Some of the tests are easily defeated, but I am simply
// implementing something for now, as a proof of concept.
// TODO: allow preference override through localStorage setting

// Return true if the app's policy permits fetching the url
export default function isAllowedURL(url) {
  assert(url instanceof URL);
  const allowed = !isCredentialedURL(url) && !isLocalURL(url);

  // TEMP: debugging issue #418, I want to add a temporary trace
  console.debug('Policy check result', url.href, allowed);

  return allowed;
}

// TODO: move to url.js? Should url.js be responsible for determining what is and is not 'local'?
function isLocalURL(url) {
  const protocol = url.protocol;
  const hostname = url.hostname;
  return hostname === 'localhost' || hostname === '127.0.0.1' || protocol === 'file:';
}
