const allowed_protocols = ['data:', 'http:', 'https:'];
const allowed_methods = ['GET', 'HEAD'];

export const fetch_policy = {
  allows_url: allows_url,
  allows_method: allows_method
};

function allows_url(url) {
  if ((!url instanceof URL)) {
    throw new TypeError('url is not a URL ' + url);
  }

  return allowed_protocols.includes(url.protocol) &&
      url.hostname !== 'localhost' && url.hostname !== '127.0.0.1' &&
      !url.username && !url.password;
}

function allows_method(raw_method) {
  const method = raw_method ? raw_method.toUpperCase() : 'GET';
  return allowed_methods.includes(method);
}
