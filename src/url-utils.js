// See license.md

'use strict';

class URLUtils {

  // @param url {URL}
  // @returns {String} lowercase extension
  static getExtension(url) {
    const path = url.pathname;
    const lastDot = path.lastIndexOf('.');
    if(lastDot !== -1) {
      const ext = path.substring(lastDot + 1);
      const len = ext.length;
      if(len > 0 && len < 5) {
        return ext.toLowerCase();
      }
    }
  }

  // @param urlString {String}
  // @param baseURL {URL}
  static resolve(urlString, baseURL) {
    if(typeof urlString !== 'string') {
      throw new TypeError();
    }

    if(!URLUtils.isURLObject(baseURL)) {
      throw new TypeError();
    }

    if(URLUtils.hasJavascriptProtocol(urlString) ||
      URLUtils.hasDataProtocol(urlString)) {
      return null;
    }

    try {
      return new URL(urlString, baseURL);
    } catch(error) {
      console.warn(error);
    }

    return null;
  }

  // TODO: does this belong in ObjectUtils?
  static isURLObject(value) {
    return Object.prototype.toString.call(value) === '[object URL]';
  }

  static hasDataProtocol(urlString) {
    return /^\s*data:/i.test(urlString);
  }

  static hasJavascriptProtocol(urlString) {
    return /^\s*javascript:/i.test(urlString);
  }
}
