export function url_is_allowed(url) {
  if ((!url instanceof URL)) {
    throw new TypeError('url is not a URL');
  }

  const protocol = url.protocol;
  const hostname = url.hostname;

  // Quickly check for data urls and allow them before any other tests. Data
  // URI fetches do not involve the network so there is no policy concern
  if (protocol === 'data:') {
    return true;
  }

  if (hostname === 'localhost') {
    return false;
  }


  if (hostname === '127.0.0.1') {
    return false;
  }

  const protocol_blacklist =
      ['about:', 'chrome:', 'chrome-extension:', 'file:'];
  if (protocol_blacklist.includes(protocol)) {
    return false;
  }

  if (url.username || url.password) {
    return false;
  }

  return true;
}
