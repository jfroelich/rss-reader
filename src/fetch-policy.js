'use strict';

// import rbl.js
// import net/url.js

// NOTE: this is the initial implementation, probably going to change
// drastically, is definitely not very reliable or accurate
// TODO: some of the tests are easily defeated, but I am simply implementing
// something for now, as a proof of concept
// TODO: allow preference override through localStorage setting

class FetchPolicy {

  // TODO: move to url-utils.js?
  static isLocalURL(url) {
    const protocol = url.protocol;
    const hostname = url.hostname;
    return hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      protocol === 'file:';
  }

  // TODO: move to url-utils.js
  static isCredentialedURL(url) {
    return url.username || url.password;
  }

  // Return true if the app's policy permits fetching the url
  static isAllowedURL(url) {
    assert(URLUtils.isCanonical(url));
    const urlo = new URL(url);
    return !this.isCredentialedURL(urlo) && !this.isLocalURL(urlo);
  }
}
