// See license.md

'use strict';

class ExtensionUtils {
  static getAlarm(name) {
    return new Promise(function(resolve) {
      chrome.alarms.get(name, resolve);
    });
  }

  static async show() {
    const viewURL = chrome.extension.getURL('slideshow.html');
    const newtabURL = 'chrome://newtab/';
    let tabs = await ExtensionUtils.findTabsByURL(viewURL);

    // First try switching back to the extension's tab if open
    if(tabs && tabs.length)
      return chrome.tabs.update(tabs[0].id, {'active': true});
    // Next try replacing the new tab if open
    tabs = await ExtensionUtils.findTabsByURL(newtabURL);
    if(tabs && tabs.length)
      return chrome.tabs.update(tabs[0].id, {'active': true, 'url': viewURL});
    // Otherwise open a new tab
    chrome.tabs.create({'url': viewURL});
  }

  // Resolves with an array of tabs. Requires 'tabs' permission
  // @param url {String} the url of the tab searched for
  static findTabsByURL(url) {
    return new Promise((resolve) => chrome.tabs.query({'url': url}, resolve));
  }
}


class ObjectUtils {

  static isURL(obj) {
    return Object.prototype.toString.call(obj) === '[object URL]';
  }

  // Returns a new object that is a copy of the input less empty properties. A
  // property is empty if it s null, undefined, or an empty string. Ignores
  // prototype, deep objects, getters, etc. Impure.
  // TODO: reuse ObjectUtils.filter?
  static filterEmptyProps(obj) {
    const copy = {};
    const hasOwnProp = Object.prototype.hasOwnProperty;

    for(let prop in obj) {
      if(hasOwnProp.call(obj, prop)) {
        const value = obj[prop];
        if(value !== undefined && value !== null && value !== '')
          copy[prop] = value;
      }
    }
    return copy;
  }

  // Creates a new object only containing properties where predicate returns
  // true. Predicate is given props obj and prop name
  static filter(obj, predicate) {
    const copy = {};
    for(let prop in obj) {
      if(predicate(obj, prop)) {
        copy[prop] = obj[prop];
      }
    }
    return copy;
  }

  // Calculates the approximate size of a value in bytes. This should only be
  // used for basic testing because it is hilariously inaccurate.
  // Adapted from http://stackoverflow.com/questions/1248302
  // Generally does not work on built-ins (dom, XMLHttpRequest, etc)
  static sizeof(obj) {
    const seen = [];
    const stack = [obj];
    const hasOwnProp = Object.prototype.hasOwnProperty;
    const toString = Object.prototype.toString;
    let size = 0;
    while(stack.length) {
      const value = stack.pop();

      // typeof null === 'object'
      if(value === null)
        continue;

      switch(typeof value) {
        case 'undefined':
          break;
        case 'boolean':
          size += 4;
          break;
        case 'string':
          size += value.length * 2;
          break;
        case 'number':
          size += 8;
          break;
        case 'function':
          size += 2 * value.toString().length;
          break;
        case 'object':
          if(seen.indexOf(value) === -1) {
            seen.push(value);
            if(ArrayBuffer.isView(value)) {
              size += value.length;
            } else if(Array.isArray(value)) {
              stack.push(...value);
            } else {
              const toStringOutput = toString.call(value);
              if(toStringOutput === '[object Date]') {
                size += 8;// guess
              } else if(toStringOutput === '[object URL]') {
                size += 2 * value.href.length;// guess
              } else {
                for(let prop in value) {
                  if(hasOwnProp.call(value, prop)) {
                    size += prop.length * 2;// prop name
                    stack.push(value[prop]);
                  }
                }
              }
            }
          }
          break;
        default:
          break;// ignore
      }
    }

    return size;
  }
}

class StringUtils {
  static condenseWhitespace(str) {
    return str.replace(/\s{2,}/g, ' ');
  }

  // Returns a new string where Unicode Cc-class characters have been removed
  // Adapted from http://stackoverflow.com/questions/4324790
  // http://stackoverflow.com/questions/21284228
  // http://stackoverflow.com/questions/24229262
  static filterControlChars(str) {
    return str.replace(/[\x00-\x1F\x7F-\x9F]/g, '');
  }
}

class DateUtils {
  static format(date, delimiter) {
    const parts = [];
    if(date) {
      // getMonth is a zero based index
      parts.push(date.getMonth() + 1);
      parts.push(date.getDate());
      parts.push(date.getFullYear());
    }
    return parts.join(delimiter || '/');
  }
}

class ElementUtils {
  static fade(element, duration, delay) {
    return new Promise(function(resolve, reject) {
      const style = element.style;
      if(style.display === 'none') {
        style.display = '';
        style.opacity = '0';
      }

      if(!style.opacity)
        style.opacity = style.display === 'none' ? '0' : '1';
      element.addEventListener('webkitTransitionEnd', resolve, {'once': true});
      // property duration function delay
      style.transition = `opacity ${duration}s ease ${delay}s`;
      style.opacity = style.opacity === '1' ? '0' : '1';
    });
  }
}
