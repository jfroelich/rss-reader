/*

# fetch-policy

### notes and todos
* Allow various overrides through localStorage setting or some config setting?
* Of course things like hosts file can be manipulated to whatever. This is just
one of the low-hanging fruits. Prevent fetches to local host urls.
* When checking against localhost values, again, ignores things like punycode,
IPv6, host manipulation, local dns manipulation, etc. This is just a simple and
typical case
* When checking for username/pass, prevent fetches of urls containing
credentials. Although fetch implicitly throws in this case, I prefer to
explicit. Also, this is a public function in use by other modules that may not
call fetch (e.g. see fetch_image_element) where I want the same policy to apply.


*/

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
