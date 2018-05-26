/*

# cross-site
**WARNING**: This is insecure because it uses approximations that are not
guaranteed to be correct.

The module principally exports the function `is_external_url`. The
`is_external_url` function returns `true` when the `other_url` parameter is
*external* to the `document_url` parameter.

A url is external when it comes from a different website. This could be because
the origin is different. However, this may allow for ignoring differences in the
subdomain, by only looking at the top domain. In other words,
http://subdomain.domain.com and http://www.domain.com could be considered the
same website, so, for example, a document from the domain that contains an
embedded resource, such as an image, that comes from the subdomain, would still
consider the image as internal.

Classifying a url as internal/external is useful for determining whether
fetching an embedded resource (e.g. an image) would probably involve a network
request to a different website. For example, a module that searches for and
removes telemetry features may consider an element with an external url as an
telemetry indicator.

### Notes and todos
* Does origin include port? Maybe I should be doing port comparison at certain
points in the logic
* If I ever get around to trying to make the is_geographical_domain test more
accurate, a good resource is
https://publicsuffix.org/list/public_suffix_list.dat
* If I want to handle urls more accurately, review punycode issues
* Consider making an ip address module for more accurate ip address handling
* Cite research


*/

const local_protocols = ['data:', 'mailto:', 'tel:', 'javascript:'];

export const MODE_UNKNOWN = 0;
export const MODE_STRICT = 2;
export const MODE_SLOPPY = 1;

export function is_external_url(document_url, other_url, mode = MODE_UNKNOWN) {
  if (!(document_url instanceof URL)) {
    throw new TypeError('document_url is not a URL');
  }

  if (!(other_url instanceof URL)) {
    throw new TypeError('other_url is not a URL');
  }

  if (local_protocols.includes(other_url.protocol)) {
    return false;
  }

  if (mode === MODE_STRICT) {
    return document_url.origin !== other_url.origin;
  }

  const doc_domain = url_get_upper_domain(document_url);
  const other_domain = url_get_upper_domain(other_url);
  return doc_domain !== other_domain;
}

function url_get_upper_domain(url) {
  // NOTE: ignores port
  if (hostname_is_ipv4(url.hostname) || hostname_is_ipv6(url.hostname)) {
    return url.hostname;
  }

  const levels = url.hostname.split('.');

  // Handle the simple cases of 'localhost' or 'example.com'
  // NOTE: ignores port
  if (levels.length < 3) {
    return url.hostname;
  }

  // Using the full suffix list is overkill so use tld character length
  const top_level = levels[levels.length - 1];
  const reverse_offset = top_level.length === 2 ? -3 : -2;
  return levels.slice(reverse_offset).join('.');
}

function hostname_is_ipv4(string) {
  if (typeof string !== 'string') {
    return false;
  }

  const parts = string.split('.');
  if (parts.length !== 4) {
    return false;
  }

  for (const part of parts) {
    const digit = parseInt(part, 10);
    if (isNaN(digit) || digit < 0 || digit > 255) {
      return false;
    }
  }

  return true;
}

function hostname_is_ipv6(value) {
  return typeof value === 'string' && value.includes(':');
}
