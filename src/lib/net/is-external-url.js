const local_protocols = ['data:', 'mailto:', 'tel:', 'javascript:'];

export const MODE_UNKNOWN = 0;
export const MODE_STRICT = 2;
export const MODE_SLOPPY = 1;

// WARNING: this is insecure because it is approximate
// Returns true when the other_url is external to the document_url. A url is
// external when it comes from a different website. This could be because the
// origin is different. However, this may allow for ignoring differences in the
// subdomain, by only looking at the top domain.
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

// NOTE: ignores port
export function url_get_upper_domain(url) {
  if (hostname_is_ipv4(url.hostname) || hostname_is_ipv6(url.hostname)) {
    return url.hostname;
  }

  const levels = url.hostname.split('.');

  // Handle the simple case of localhost or example.com
  if (levels.length < 3) {
    return url.hostname;
  }

  // Using a full geo-suffix list is overkill so use tld length to guess
  const top_level = levels[levels.length - 1];
  const reverse_offset = top_level.length === 2 ? -3 : -2;
  return levels.slice(reverse_offset).join('.');
}

export function hostname_is_ipv4(string) {
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

export function hostname_is_ipv6(value) {
  return typeof value === 'string' && value.includes(':');
}
