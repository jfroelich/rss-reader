import {assert} from '/src/lib/assert.js';

// Return a new array consisting of only distinct values (compared by
// equality). Relative order is maintained. Throws an error if the input is not
// an array.
export function unique(array) {
  // The lambda only returns true when the index of the input value is
  // equal to the index of the first time the value appears. Obviously not the
  // most efficient but pretty simple.
  // See https://stackoverflow.com/questions/11246758
  return array.filter((value, index) => array.indexOf(value) === index);
}

// Similar to unique, but with an optional compute function that derives a
// value to use for comparison to other values. When |compute| is not specified
// it defaults to a comparison of the original value.
export function unique_compute(array, compute) {
  if (typeof compute !== 'function') {
    return unique(array);
  }

  const seen_computed = [];
  return array.filter(value => {
    const computed_value = compute(value);
    if (seen_computed.includes(computed_value)) {
      return false;
    } else {
      seen_computed.push(computed_value);
      return true;
    }
  });
}

// Maybe generate and show a desktop notification provided that notifications
// are enabled in settings. |note| has optional properties name, message, and
// url (string). Defaults are provided for missing properties.
export function show_notification(config, note) {
  if (!config.read_boolean('show_notifications')) {
    return;
  }

  const title = note.title || 'Untitled';
  const message = note.message || '';

  const details = {};
  details.body = message || '';

  const default_icon = chrome.extension.getURL('/images/rss_icon_trans.gif');
  details.icon = note.url || default_icon;

  const notification = new Notification(title, details);
  notification.addEventListener('click', event => {
    try {
      const hwnd = window.open();
      hwnd.close();
    } catch (error) {
      console.error(error);
      return;
    }
    utils.open_view(config).catch(console.warn);
  });
}

export function query_idle_state(idle_secs) {
  return new Promise((resolve, reject) => {
    if (chrome && chrome.idle && chrome.idle.queryState) {
      chrome.idle.queryState(idle_secs, resolve);
    } else {
      reject(new Error('chrome.idle unavailable'));
    }
  });
}

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

  let doc;
  try {
    doc = parse_html(html);
  } catch (error) {
    console.debug(error);
    return 'Unsafe html';
  }

  if (!replacement) {
    return doc.body.textContent;
  }

  const it = doc.createNodeIterator(doc.body, NodeFilter.SHOW_TEXT);
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
  const doc = parser.parseFromString(html_string, 'text/html');
  const parser_error = doc.querySelector('parsererror');
  if (parser_error) {
    return '<html><body>Unsafe HTML</body></html>';
  }

  const it = doc.createNodeIterator(doc.body, NodeFilter.SHOW_TEXT);
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
    return doc.documentElement.outerHTML;
  } else {
    return doc.body.innerHTML;
  }
}

// Parses a string into an html document. When html is a fragment, it will be
// inserted into a new document using a default template provided by the
// browser, that includes a document element and usually a body. If not a
// fragment, then it is merged into a document with a default template.
export function parse_html(html) {
  assert(typeof html === 'string');

  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');

  const error = doc.querySelector('parsererror');
  if (error) {
    const message = condense_whitespace(error.textContent);
    throw new Error(message);
  }

  return doc;
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

// Returns a new string where the publisher information has been stripped. For
// example, in the string "Florida man shoots self - Your Florida News", the
// algorithm would hopefully identify the publisher as "Your Florida news" and
// then return the string "Florida man shoots self" where the publisher has been
// filtered. |delims| is an optional array of delimiting characters that split
// the title between content and publisher. |min_title_length| is a threshold
// below which any filtering is rejected.
export function filter_publisher(title, delims, min_title_length) {
  assert(typeof title === 'string');
  const default_delims = ['-', '|', ':'];
  if (!Array.isArray(delims)) {
    delims = default_delims;
  }

  const default_min_title_length = 20;
  if (isNaN(min_title_length)) {
    min_title_length = default_min_title_length;
  } else {
    assert(min_title_length >= 0);
  }

  if (title.length < min_title_length) {
    return title;
  }

  if (delims.length < 1) {
    return title;
  }

  const tokens = tokenize_words(title);

  // Basically just assume there is no point to looking if we are only dealing
  // with 3 tokens or less. This is a tentative conclusion. Note that delimiters
  // are individual tokens here, and multiple consecutive delimiters will
  // constitute only one token. Note that this also implicitly handles the 0
  // tokens case.
  if (tokens.length < 4) {
    return title;
  }

  let delimiter_index = -1;
  for (let i = tokens.length - 2; i > -1; i--) {
    const token = tokens[i];
    if (delims.includes(token)) {
      delimiter_index = i;
      break;
    }
  }

  if (delimiter_index === -1) {
    return title;
  }

  // Regardless of the number of words in the full title, if the publisher we
  // find has too many words, the delimiter probably did not delimit the
  // publisher, so bail out.
  if (tokens.length - delimiter_index - 1 > 5) {
    return title;
  }

  // If there are more publisher words than non-publisher words in the title,
  // then we should not filter out the publisher, because this indicates a
  // false positive identification of the delimiter, most of the time,
  // empirically.
  const non_pub_word_count = delimiter_index;
  const pub_word_count = tokens.length - delimiter_index - 1;
  if (non_pub_word_count < pub_word_count) {
    return title;
  }

  const non_pub_tokens = tokens.slice(0, delimiter_index);
  return non_pub_tokens.join(' ');
}

// Split a string into smaller strings based on intermediate whitespace. Throws
// an error if string is not a String object. Returns an array.
function tokenize_words(string) {
  // The implicit trim avoids producing empty tokens. The input might already
  // be trimmed but we cannot rely on that so we have to accept the overhead.
  return string.trim().split(/\s+/g);
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
