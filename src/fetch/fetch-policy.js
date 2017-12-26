import assert from "/src/utils/assert.js";

// This module is a simple abstraction for determining whether or not a url is permitted to be
// fetched.

// TODO: allow various overrides through localStorage setting or some config setting?

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

  const protocolBlacklist = [
    'about:',
    'chrome:',
    'chrome-extension:',
    'file:'
  ];

  if(protocolBlacklist.includes(protocol)) {
    return false;
  }

  // Prevent fetches of urls containing credentials
  // NOTE: fetch throws a TypeError anyway
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
