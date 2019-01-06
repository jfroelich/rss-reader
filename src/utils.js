import assert from '/src/assert.js';

export function filter_unprintables(value) {
  if (typeof value !== 'string') {
    return value;
  }

  // \t \u0009 9, \n \u000a 10, \f \u000c 12, \r \u000d 13
  // The regex matches 0-8, 11, and 14-31, all inclusive
  return value.replace(/[\u0000-\u0008\u000b\u000e-\u001F]+/g, '');
}


export function filter_controls(value) {
  return value.replace(/[\x00-\x1F\x7F-\x9F]+/g, '');
}

// Replaces tags in the input string with the replacement. If a replacement is
// not specified, then tags are removed.
export function replace_tags(html, replacement) {
  assert(typeof html === 'string');
  assert(replacement === undefined || typeof replacement === 'string');

  if (!html) {
    return html;
  }

  let document;
  try {
    document = parse_html(html);
  } catch (error) {
    console.debug(error);
    return 'Unsafe html';
  }

  if (!replacement) {
    return document.body.textContent;
  }

  const it = document.createNodeIterator(document.body, NodeFilter.SHOW_TEXT);
  const node_values = [];
  for (let node = it.nextNode(); node; node = it.nextNode()) {
    node_values.push(node.nodeValue);
  }

  return node_values.join(replacement);
}

export function filter_empty_properties(value) {
  const has_own = Object.prototype.hasOwnProperty;

  if (value && typeof value === 'object') {
    for (const key in value) {
      if (has_own.call(value, key)) {
        const pv = value[key];
        if (pv === null || pv === '' || pv === undefined) {
          delete value[key];
        }
      }
    }
  }
}

// Calculates the approximate byte size of a value. This should only be used for
// informational purposes because it is hilariously inaccurate. Adapted from
// http://stackoverflow.com/questions/1248302. This function generally does not
// work with built-ins, which are objects that are a part of the basic
// Javascript library, like Document, or Element. There are a few built-ins that
// are supported, such as URL.
export function sizeof(input_value) {
  const visited_objects = [];
  const stack = [input_value];
  const has_own_prop = Object.prototype.hasOwnProperty;
  const object_to_string = Object.prototype.toString;

  let sz = 0;

  while (stack.length) {
    const value = stack.pop();

    // typeof null === 'object'
    if (value === null) {
      continue;
    }

    switch (typeof value) {
      case 'undefined':
        break;
      case 'boolean':
        sz += 4;
        break;
      case 'string':
        sz += value.length * 2;
        break;
      case 'number':
        sz += 8;
        break;
      case 'function':
        // Treat as some kind of function identifier
        sz += 8;
        break;
      case 'object':
        if (visited_objects.indexOf(value) === -1) {
          visited_objects.push(value);

          if (ArrayBuffer.isView(value)) {
            sz += value.length;
          } else if (Array.isArray(value)) {
            stack.push(...value);
          } else {
            const to_string_output = object_to_string.call(value);
            if (to_string_output === '[object Date]') {
              sz += 8;  // guess
            } else if (to_string_output === '[object URL]') {
              sz += 2 * value.href.length;  // guess
            } else {
              for (let prop_name in value) {
                if (has_own_prop.call(value, prop_name)) {
                  // size of the property name itself, 16bit?
                  sz += prop_name.length * 2;
                  stack.push(value[prop_name]);
                }
              }
            }
          }
        }
        break;
      default:
        break;  // ignore
    }
  }

  return sz;
}

// Open the slideshow view in a tab.
// @param config {Module} a reference to a config module object
export async function open_view(config) {
  // Check if the view is open and switch to it
  const url_string = chrome.extension.getURL('slideshow.html');
  const view_tab = await find_tab(url_string);
  if (view_tab) {
    chrome.tabs.update(view_tab.id, {active: true});
    return;
  }

  // Otherwise, try and reuse the newtab tab
  const reuse_newtab = config.read_boolean('reuse_newtab');
  if (reuse_newtab) {
    const newtab = await find_tab('chrome://newtab/');
    if (newtab) {
      chrome.tabs.update(newtab.id, {active: true, url: url_string});
      return;
    }
  }

  // Otherwise, open the view in a new tab
  chrome.tabs.create({active: true, url: url_string});
}

// Searches for an open tab with the given url
function find_tab(url_string) {
  return new Promise(resolve => {
    const query = {url: url_string};
    chrome.tabs.query(query, tabs => {
      if (tabs && tabs.length) {
        resolve(tabs[0]);
      }
      resolve();
    });
  });
}

export function condense_whitespace(value) {
  return value.replace(/\s\s+/g, ' ');
}

export function file_read_text(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsText(file);
    reader.onload = _ => resolve(reader.result);
    reader.onerror = _ => reject(reader.error);
  });
}

export function truncate_html(html_string, position, suffix) {
  if (typeof html_string !== 'string') {
    return '';
  }

  if (!Number.isInteger(position)) {
    throw new TypeError('position must be an integer');
  }

  if (position < 0) {
    throw new TypeError('position must be greater than or equal to 0');
  }

  const ELLIPSIS = '\u2026';
  if (typeof suffix !== 'string') {
    suffix = ELLIPSIS;
  }

  const parser = new DOMParser();
  const document = parser.parseFromString(html_string, 'text/html');
  const parser_error = document.querySelector('parsererror');
  if (parser_error) {
    return 'Unsafe malformed html string';
  }

  const it = document.createNodeIterator(document.body, NodeFilter.SHOW_TEXT);
  let total_length = 0;

  for (let node = it.nextNode(); node; node = it.nextNode()) {
    const value = node.nodeValue;
    const value_length = value.length;
    if (total_length + value_length >= position) {
      const remaining_length = position - total_length;
      node.nodeValue = value.substr(0, remaining_length) + suffix;
      break;
    } else {
      total_length += value_length;
    }
  }

  for (let node = it.nextNode(); node; node = it.nextNode()) {
    node.remove();
  }

  if (/<html/i.test(html_string)) {
    return document.documentElement.outerHTML;
  } else {
    return document.body.innerHTML;
  }
}

// Parses a string into an html document. When html is a fragment, it will be
// inserted into a new document using a default template provided by the
// browser, that includes a document element and usually a body. If not a
// fragment, then it is merged into a document with a default template.
export function parse_html(html) {
  assert(typeof html === 'string');

  const parser = new DOMParser();
  const document = parser.parseFromString(html, 'text/html');

  const error = document.querySelector('parsererror');
  if (error) {
    const message = condense_whitespace(error.textContent);
    throw new Error(message);
  }

  return document;
}

export function url_get_extension(url) {
  const path = url.pathname;

  if (path.length > 2) {
    const last_dot_pos_p1 = path.lastIndexOf('.') + 1;
    if (last_dot_pos_p1 > 0 && last_dot_pos_p1 < path.length) {
      const ext = path.substring(last_dot_pos_p1);
      if (ext.length < 5 && is_alphanumeric(ext)) {
        return ext;
      }
    }
  }
}

export function is_alphanumeric(value) {
  return !/[^\p{L}\d]/u.test(value);
}

// Returns a new string where certain characters in the input string have been
// replaced with html entities. If input is not a string returns undefined.
// See https://stackoverflow.com/questions/784586.
export function escape_html(html) {
  const pattern = /[<>"'`]/g;
  if (typeof html === 'string') {
    return html.replace(pattern, encode_first_character);
  }
}

function encode_first_character(string) {
  return '&#' + string.charCodeAt(0) + ';';
}
