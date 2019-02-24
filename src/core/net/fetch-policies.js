// A default permit-all policy
export function permit_all(request) {
  return true;
}

// A simple, custom, hardcoded fetch policy
// * allow only http/https/data
// * allow only get/head
// * disallow loopback
// * disallow credentials
export function permit_default(request) {
  const good_protocols = ['data', 'http', 'https'];
  const good_methods = ['get', 'head'];
  const bad_hostnames = ['localhost', '127.0.0.1'];

  const url = request.url;
  const method = request.method ? request.method.toLowerCase() : 'get';
  const protocol = url.protocol.substring(0, url.protocol.length - 1);

  return good_protocols.includes(protocol) && !bad_hostnames(url.hostname) &&
      !url.username && !url.password && good_methods.includes(method);
}
