import {assert} from '/src/lib/assert.js';
import * as string_utils from '/src/lib/string-utils.js';

// Very minimally validate a url string
export function is_valid_url_string(value) {
  return typeof value === 'string' && value.length > 1 &&
      value.length <= 3000 && !value.trim().includes(' ');
}

export function url_get_extension(url) {
  const path = url.pathname;

  if (path.length > 2) {
    const last_dot_pos_p1 = path.lastIndexOf('.') + 1;
    if (last_dot_pos_p1 > 0 && last_dot_pos_p1 < path.length) {
      const ext = path.substring(last_dot_pos_p1);
      if (ext.length < 5 && string_utils.is_alphanumeric(ext)) {
        return ext;
      }
    }
  }
}

// NOTE: ignores port
export function url_get_upper_domain(url) {
  assert(url instanceof URL);
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
