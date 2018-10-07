// TODO: this should not be a parameter to fetch2.fetch. Instead, fetch2 should
// be a generic fetch library, and then I have an app-specific wrapper fetch
// library that wraps the generic library, and within this wrapper, I introduce
// the app's fetch policy concerns. So this entire approach so far was wrong,
// because it makes it difficult to pluck out app specific crap from a genric
// lib, and fetch2 should ideally be a generic library that just adds a few more
// features to native fetch.

// Returns whether a given request is fetchable according to the app's policy.
// This hardcodes the app's policy into a function. In general, only
// http-related fetches are permitted, and not against local host. This also
// disallows embedded credentials explicitly despite that being an implicit
// constraint imposed by the native fetch.
export function is_allowed_request(request) {
  const method = request.method || 'GET';
  const url = request.url;

  const allowed_protocols = ['data', 'http', 'https'];
  const allowed_methods = ['GET', 'HEAD'];

  const protocol = url.protocol.substring(0, url.protocol.length - 1);

  return allowed_protocols.includes(protocol) && url.hostname !== 'localhost' &&
      url.hostname !== '127.0.0.1' && !url.username && !url.password &&
      allowed_methods.includes(method.toUpperCase());
}
