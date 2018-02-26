
function assert(value, message) {
  if (!value) throw new Error(message || 'Assertion error');
}

// Returns true if other_url is 'external' to the document_url. Inaccurate and
// insecure.
export function url_is_external(document_url, other_url) {
  // Certain protocols are never external in the sense that a network request
  // is not performed
  const local_protocols = ['data:', 'mailto:', 'tel:', 'javascript:'];
  if (local_protocols.includes(other_url.protocol)) {
    return false;
  }

  const doc_domain = url_get_upper_domain(document_url);
  const other_domain = url_get_upper_domain(other_url);
  return doc_domain !== other_domain;
}

// Returns the 1st and 2nd level domains as a string. Basically hostname
// without subdomains. This only does minimal symbolic validation, and is
// inaccurate.
function url_get_upper_domain(url) {
  assert(url instanceof URL);

  if (hostname_is_ipv4(url.hostname) || hostname_is_ipv6(url.hostname)) {
    return url.hostname;
  }

  const levels = url.hostname.split('.');
  // We know hostname is a non-0 length string, so we know levels.length is
  // greater than 0. Handle the simple cases of 'localhost' or 'example.com'
  if (levels.length < 3) {
    return url.hostname;
  }

  // Using the full list from
  // https://publicsuffix.org/list/public_suffix_list.dat is overkill. Decide
  // based on tld character length. We know levels.length > 2.
  const top_level = levels[levels.length - 1];
  const reverse_offset = top_level.length === 2 ? -3 : -2;
  // [1,2,3,4].slice(-2) => [3,4]
  // [1,2,3,4].slice(-3) => [2,3,4]
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

// Expects a hostname string property value from a URL object.
function hostname_is_ipv6(value) {
  return typeof value === 'string' && value.includes(':');
}
