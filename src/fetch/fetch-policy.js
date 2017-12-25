import assert from "/src/utils/assert.js";

// This module is a simple abstraction for determining whether or not a url is permitted to be
// fetched. It should be used for example to avoid trying to fetch various urls, such as file://
// urls.

// NOTE: the credentialed url check is apparently a tad redundant. Calling fetch with such a url
// will automatically throw a TypeError, just learned that. No longer sure if I need to, or want
// to, have an explicit check for such urls.

// NOTE: this is the initial implementation, probably going to change drastically, is definitely
// not very reliable or accurate. Some of the tests are easily defeated and the tests are not
// exhaustive (e.g. ip6 ignored). However, I am simply implementing something for now because I want
// this concept to exist, even if poorly realized. The primary concern is security. One could argue
// this is pretty weak security, and weak security is stupid, but I still like the idea of at least
// giving a nod to it. Also, this is kind of a superfluous layer over whatever internal logic is
// done by fetch, but I want to be explicit and my policy may be different.

// TODO: allow various overrides through localStorage setting or some config setting?
// TODO: disallow fetches of chrome-extension:// and chrome://
// TODO: disallow about:blank and friends


// Return true if the app's policy permits fetching the url
export default function isAllowedURL(url) {
  assert(url instanceof URL);
  const protocol = url.protocol;
  const hostname = url.hostname;

  // Quickly check for data urls and allow them before any other tests. Data URI fetches do not
  // involve the network so there is no policy concern
  if(protocol === 'data:') {
    return true;
  }

  // Of course things like hosts file can be manipulated to whatever. This is just one of the
  // low-hanging fruits. Prevent fetches to local host urls.
  if(hostname === 'localhost') {
    return false;
  }

  // Again, ignores things like punycode, IPv6, host manipulation, local dns manipulation, etc.
  // This is just a simple and typical case
  if(hostname === '127.0.0.1') {
    return false;
  }

  // Disallow fetches of file urls
  if(protocol === 'file:') {
    return false;
  }

  if(protocol === 'chrome:') {
    return false;
  }

  if(protocol === 'chrome-extension:') {
    return false;
  }

  // Prevent fetches of urls containing credentials
  if(url.username || url.password) {
    return false;
  }

  return true;
}

// TODO: choose a better name, like PolicyError or something

export class PermissionsError extends Error {
  constructor(message) {
    super(message || 'Not permitted');
  }
}
