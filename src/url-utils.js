// See license.md

'use strict';

// @param url {URL}
// @returns {String} lowercase extension
function get_url_extension(url) {
  const path = url.pathname;
  const lastDot = path.lastIndexOf('.');
  if(lastDot !== -1) {
    const ext = path.substring(lastDot + 1);
    const len = ext.length;
    if(len > 0 && len < 5)
      return ext.toLowerCase();
  }
}

// @param url_str {String}
// @param base_url {URL}
function resolve_url(url_str, base_url) {
  if(typeof url_str !== 'string')
    throw new TypeError();
  if(!is_url_object(base_url))
    throw new TypeError();
  if(url_has_js_protocol(url_str) ||
    url_has_data_protocol(url_str))
    return null;
  try {
    return new URL(url_str, base_url);
  } catch(error) {
    console.warn(error);
  }

  return null;
}

function url_has_data_protocol(url_str) {
  return /^\s*data:/i.test(url_str);
}

function url_has_js_protocol(url_str) {
  return /^\s*javascript:/i.test(url_str);
}

// TODO: ObjectUtils?
function is_url_object(value) {
  return Object.prototype.toString.call(value) === '[object URL]';
}
