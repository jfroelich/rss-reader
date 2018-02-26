const local_protocols = ['data:', 'mailto:', 'tel:', 'javascript:'];

export const MODE_UNKNOWN = 0;
export const MODE_STRICT = 2;
export const MODE_SLOPPY = 1;

export function url_is_external(document_url, other_url, mode) {
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
