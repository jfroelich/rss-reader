const allowed_protocols = ['data:', 'http:', 'https:'];

// Restrict protocol to allowed protocols
// Deny local urls
// Deny credentialed urls
export function url_is_allowed(url) {
  if ((!url instanceof URL)) {
    throw new TypeError('url is not a URL ' + url);
  }

  return allowed_protocols.includes(url.protocol) &&
      url.hostname !== 'localhost' && url.hostname !== '127.0.0.1' &&
      !url.username && !url.password;
}
