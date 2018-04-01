
// TODO: what about a whitelist approach, only allow http/https?
const protocol_blacklist =
    ['about:', 'chrome:', 'chrome-extension:', 'file:', 'tel:', 'mailto:'];

export function url_is_allowed(url) {
  if ((!url instanceof URL)) {
    throw new TypeError('url is not a URL ' + url);
  }

  // Permit all data uris as there is no network concern, and to simplify all
  // later conditions to not have to deal with data uris
  if (url.protocol === 'data:') {
    return true;
  }

  // Deny certain protocols
  if (protocol_blacklist.includes(url.protocol)) {
    return false;
  }

  // Deny local urls
  if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') {
    return false;
  }

  // Deny credentialed urls
  if (url.username || url.password) {
    return false;
  }

  return true;
}
