// See license.md

'use strict';

class URLUtils {

  // @param url {URL}
  // @returns {String} lowercase extension
  static get_url_extension(url) {
    const path = url.pathname;
    const lastDot = path.lastIndexOf('.');
    if(lastDot !== -1) {
      const ext = path.substring(lastDot + 1);
      const len = ext.length;
      if(len > 0 && len < 5)
        return ext.toLowerCase();
    }
  }

  // @param urlString {String}
  // @param baseURL {URL}
  static resolve(urlString, baseURL) {
    if(typeof urlString !== 'string')
      throw new TypeError();
    if(!is_url_object(baseURL))
      throw new TypeError();
    if(URLUtils.url_has_js_protocol(urlString) ||
      URLUtils.url_has_data_protocol(urlString))
      return null;
    try {
      return new URL(urlString, baseURL);
    } catch(error) {
      console.warn(error);
    }

    return null;
  }

  static url_has_data_protocol(urlString) {
    return /^\s*data:/i.test(urlString);
  }

  static url_has_js_protocol(urlString) {
    return /^\s*javascript:/i.test(urlString);
  }
}

// TODO: ObjectUtils
function is_url_object(value) {
  return Object.prototype.toString.call(value) === '[object URL]';
}
