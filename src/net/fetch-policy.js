// Return whether the url is fetchable based on app-policy. This hardcodes a
// basic policy that presents itself as the app's default policy.
//
// This policy is rudimentary and should not be considered highly secure. When
// checking against localhost values, this ignores things like punycode, IPv6,
// host manipulation, local domain manipulation, etc.
//
// When checking for username/pass, prevent fetches of urls containing
// credentials. Although fetch implicitly throws in this case, I prefer to
// explicit.
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
