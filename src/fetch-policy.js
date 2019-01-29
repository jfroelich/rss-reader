// A default permit-all policy
export function PERMITTED(request) {
  return true;
}

// A simple, custom, hardcoded fetch policy
// * restrict to http/https/data
// * restrict to get/head
// * restrict to non-loopback
// * Disallow credentials
export function APP_DEFAULT(request) {
  const good_protocols = ['data', 'http', 'https'];
  const good_methods = ['get', 'head'];
  const bad_hostnames = ['localhost', '127.0.0.1'];

  const url = request.url;
  const method = request.method ? request.method.toLowerCase() : 'get';
  const protocol = url.protocol.substring(0, url.protocol.length - 1);

  return good_protocols.includes(protocol) && !bad_hostnames(url.hostname) &&
      !url.username && !url.password && good_methods.includes(method);
}
