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
