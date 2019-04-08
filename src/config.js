import * as color from '/src/color/color.js';

export function rename(old_name, new_name) {
  const value = read_string(old_name);
  if (typeof value !== 'undefined') {
    write_string(new_name, value);
  }
  remove(old_name);
}

export function has_key(key) {
  return typeof localStorage[key] !== 'undefined';
}

export function read_boolean(key) {
  return typeof localStorage[key] !== 'undefined';
}

export function write_boolean(key, value) {
  if (value) {
    localStorage[key] = '1';
  } else {
    delete localStorage[key];
  }
}

// TODO: drop support for fallback value
export function read_int(key, fallback_value) {
  const string_value = localStorage[key];
  if (string_value) {
    const integer_value = parseInt(string_value, 10);
    if (!isNaN(integer_value)) {
      return integer_value;
    }
  }

  if (Number.isInteger(fallback_value)) {
    return fallback_value;
  }

  return NaN;
}

export function write_int(key, value) {
  localStorage[key] = '' + value;
}

export function read_float(key) {
  return parseFloat(localStorage[key], 10);
}

export function write_float(key, value) {
  localStorage[key] = '' + value;
}

export function read_string(key) {
  return localStorage[key];
}

export function write_string(key, value) {
  localStorage[key] = value;
}

export function read_array(key) {
  const value = localStorage[key];
  return value ? JSON.parse(value) : [];
}

export function write_array(key, value) {
  localStorage[key] = JSON.stringify(value);
}

export function remove(key) {
  delete localStorage[key];
}

export function remove_all(keys) {
  for (const key of keys) {
    delete localStorage[key];
  }
}

// TODO: eventually figure out how to persist in localStorage
export function get_inaccessible_content_descriptors() {
  return [
    {pattern: /forbes\.com$/i, reason: 'interstitial-advert'},
    {pattern: /productforums\.google\.com$/i, reason: 'script-generated'},
    {pattern: /groups\.google\.com$/i, reason: 'script-generated'},
    {pattern: /nytimes\.com$/i, reason: 'paywall'},
    {pattern: /wsj\.com$/i, reason: 'paywall'}
  ];
}

// TODO: eventually think of how to persist in localStorage
export function get_rewrite_rules() {
  const rules = [];

  rules.push(function google_news_rule(url) {
    if (url.hostname === 'news.google.com' && url.pathname === '/news/url') {
      const param = url.searchParams.get('url');
      try {
        return new URL(param);
      } catch (error) {
      }
    }
  });

  rules.push(function techcrunch_rule(url) {
    if (url.hostname === 'techcrunch.com' && url.searchParams.has('ncid')) {
      const output = new URL(url.href);
      output.searchParams.delete('ncid');
      return output;
    }
  });

  rules.push(function facebook_exit_rule(url) {
    if (url.hostname === 'l.facebook.com' && url.pathname === '/l.php') {
      const param = url.searchParams.get('u');
      try {
        return new URL(param);
      } catch (error) {
      }
    }
  });

  return rules;
}

// Filenames of article background images
// clang-format off
const background_images = [
  'bgfons-paper_texture318.jpg',
  'CCXXXXXXI_by_aqueous.jpg',
  'paper-backgrounds-vintage-white.jpg',
  'pickering-texturetastic-gray.png',
  'reusage-recycled-paper-white-first.png',
  'subtle-patterns-beige-paper.png',
  'subtle-patterns-cream-paper.png',
  'subtle-patterns-exclusive-paper.png',
  'subtle-patterns-groove-paper.png',
  'subtle-patterns-handmade-paper.png',
  'subtle-patterns-paper-1.png',
  'subtle-patterns-paper-2.png',
  'subtle-patterns-paper.png',
  'subtle-patterns-rice-paper-2.png',
  'subtle-patterns-rice-paper-3.png',
  'subtle-patterns-soft-wallpaper.png',
  'subtle-patterns-white-wall.png',
  'subtle-patterns-witewall-3.png',
  'thomas-zucx-noise-lines.png'
];
// clang-format on

// Default font names. These must correspond to the names used in CSS.
// clang-format off
const default_fonts = [
  'ArchivoNarrow-Regular',
  'Arial',
  'Calibri',
  'Cambria',
  'CartoGothicStd',
  'Edward Tufte Roman',
  'Fanwood',
  'Georgia',
  'Inter',
  'League Mono Regular',
  'League Spartan',
  'Merriweather Regular',
  'Montserrat',
  'Noto Sans',
  'Open Sans Regular',
  'PathwayGothicOne',
  'PlayfairDisplaySC',
  'Roboto Regular'
];
// clang-format on

// The extension updated, or the background page was reloaded
export function handle_update(event) {
  const deprecated_keys = [
    'channel_name', 'db_name', 'db_open_timeout', 'db_version', 'debug',
    'entry_title_max_length', 'refresh_badge_delay', 'last_poll_date'
  ];
  for (const key of deprecated_keys) {
    remove(key);
  }

  rename('LAST_ALARM', 'last_alarm');
  rename(
      'sanitize_document_image_size_fetch_timeout', 'set_image_sizes_timeout');
  rename(
      'sanitize_document_low_contrast_default_matte', 'contrast_default_matte');
  rename('sanitize_document_emphasis_max_length', 'emphasis_max_length');
  rename('sanitize_document_table_scan_max_rows', 'table_scan_max_rows');
  rename('article_title_display_max_length', 'entry_title_max_length');
  rename('MIN_CONTRAST_RATIO', 'min_contrast_ratio');
  rename('PADDING', 'padding');
  rename('BG_IMAGE', 'bg_image');
  rename('BG_COLOR', 'bg_color');
  rename('HEADER_FONT_FAMILY', 'header_font_family');
  rename('HEADER_FONT_SIZE', 'header_font_size');
  rename('BODY_FONT_FAMILY', 'body_font_family');
  rename('BODY_FONT_SIZE', 'body_font_size');
  rename('BODY_LINE_HEIGHT', 'body_line_height');
  rename('JUSTIFY_TEXT', 'justify_text');
  rename('COLUMN_COUNT', 'column_count');
  rename('SHOW_NOTIFICATIONS', 'notifications_enabled');
  rename('ONLY_POLL_IF_IDLE', 'only_poll_if_idle');
  rename('show_notifications', 'notifications_enabled');

  // Strip old path from bg_image setting
  const path = read_string('bg_image');
  if (path && path.startsWith('/images/')) {
    write_string('bg_image', path.substring('/images/'.length));
  }
}

export function init(event) {
  write_boolean('reuse_newtab', true);
  write_boolean('notifications_enabled', true);
  write_boolean('only_poll_if_idle', true);
  write_int('idle_poll_secs', 30);
  write_int('contrast_default_matte', color.WHITE);
  write_int('emphasis_max_length', 200);
  write_int('table_scan_max_rows', 20);
  write_float('min_contrast_ratio', 4.5);
  write_int('set_image_sizes_timeout', 300);
  write_int('initial_entry_load_limit', 3);
  write_float('slide_transition_duration', 0.16);
  write_int('padding', 180);
  write_string('bg_color', '#fefdfd');
  write_string('header_font_family', 'Open Sans Regular');
  write_int('header_font_size', 70);
  write_string('body_font_family', 'Edward Tufte Roman');
  write_int('body_font_size', 36);
  write_int('body_line_height', 46);
  write_int('column_count', 1);
  write_boolean('justify_text', false);
  write_array('background_images', background_images);

  // NOTE: this is within an init context, so we disregard any existing value
  // and overwrite the value with the defaults. this will cause any custom
  // registered fonts to no longer exist
  write_array('fonts', default_fonts);
}

// React to a localStorage property change. Note that this is only fired by the
// browser when another page changes local storage. If a local change is made
// and there is a desire for the same page to hear it, then the caller must
// call this directly with a fake event or something like this:
// https://stackoverflow.com/questions/26974084
// Note this event listener should only be bound by a page where the appropriate
// stylesheets are loaded. This assumes those stylesheets exist.
export function storage_onchange(event) {
  if (!event.isTrusted || event.type !== 'storage') {
    return;
  }

  const key = event.key;
  if (key === 'padding') {
    const rule = find_css_rule('.slide-padding-wrapper');
    const padding = parseInt(event.newValue, 10);
    rule.style.padding = isNaN(padding) ? '' : padding + 'px';
    return;
  }

  if (key === 'bg_image') {
    const rule = find_css_rule('.entry');
    const path = event.newValue;
    rule.style.backgroundImage = path ? `url("/images/${path}")` : '';
    return;
  }

  if (key === 'bg_color') {
    const rule = find_css_rule('.entry');
    const color = event.newValue;
    rule.style.backgroundColor = color ? color : '';
    return;
  }

  if (key === 'header_font_family') {
    const rule = find_css_rule('.entry .entry-title');
    const family = event.newValue;
    rule.style.fontFamily = family ? family : 'initial';
    return;
  }

  if (key === 'header_font_size') {
    const rule = find_css_rule('.entry .entry-title');
    const size = parseInt(event.newValue, 10);
    rule.style.fontSize = isNaN(size) ? '' : size + 'px';
    return;
  }

  if (key === 'body_font_family') {
    const rule = find_css_rule('.entry .entry-content');
    const family = event.newValue;
    rule.style.fontFamily = family ? family : 'initial';
    return;
  }

  if (key === 'body_font_size') {
    const rule = find_css_rule('.entry .entry-content');
    const size = parseInt(event.newValue, 10);
    rule.style.fontSize = isNaN(size) ? '' : size + 'px';
    return;
  }

  if (key === 'justify_text') {
    const rule = find_css_rule('.entry .entry-content');
    rule.style.textAlign = event.newValue ? 'justify' : 'left';
    return;
  }

  if (key === 'body_line_height') {
    const rule = find_css_rule('.entry .entry-content');
    const height = parseInt(event.newValue, 10);
    rule.style.lineHeight = isNaN(height) ? '' : height + 'px';
    return;
  }

  if (key === 'column_count') {
    const rule = find_css_rule('.entry .entry-content');
    const count = parseInt(event.newValue, 10);
    if (!isNaN(count) && count >= 0 && count <= 3) {
      rule.style.columnCount = count;
    } else {
      rule.style.columnCount = '';
    }
  }
}

// Initialize the dom with css settings from config.
export function dom_load_listener() {
  const sheet = document.styleSheets[0];
  sheet.addRule('.entry', page_style_entry_rule_create());
  sheet.addRule('.entry .entry-title', page_style_title_rule_create());
  sheet.addRule('.entry .entry-content', page_style_content_rule_create());

  const padding = read_int('padding');
  if (!isNaN(padding)) {
    sheet.addRule('.slide-padding-wrapper', 'padding: ' + padding + 'px');
  }
}

function page_style_entry_rule_create() {
  const buffer = [];

  let path = read_string('bg_image');
  const color = read_string('bg_color');

  if (path) {
    buffer.push(`background: url("/images/${path}");`);
  } else if (color) {
    buffer.push(`background: ${color};`);
  }

  return buffer.join('');
}

function page_style_title_rule_create(sheet) {
  const buffer = [];
  const font_size = read_int('header_font_size');
  if (!isNaN(font_size)) {
    buffer.push(`font-size: ${font_size}px;`);
  }

  const font_family = read_string('header_font_family');
  if (font_family) {
    buffer.push(`font-family: ${font_family};`);
  }

  return buffer.join('');
}

function page_style_content_rule_create(sheet) {
  const buffer = [];
  const font_size = read_int('body_font_size');
  if (!isNaN(font_size)) {
    buffer.push(`font-size: ${font_size}px;`);
  }

  if (read_boolean('justify_text')) {
    buffer.push('text-align: justify;');
  }

  const font_family = read_string('body_font_family');
  if (font_family) {
    buffer.push(`font-family: ${font_family};`);
  }

  const line_height = read_int('body_line_height');
  if (!isNaN(line_height)) {
    buffer.push(`line-height: ${line_height}px;`);
  }

  const column_count = read_int('column_count');
  if (column_count === 2 || column_count === 3) {
    buffer.push(`column-count: ${column_count};`);
    buffer.push('column-gap: 30px;');
    buffer.push('column-rule: 1px outset #aaaaaa;');
  }

  return buffer.join('');
}

// Returns the first matching css rule or undefined
// @param selector_text {String}
// @return {CSSStyleRule}
function find_css_rule(selector_text) {
  for (const sheet of document.styleSheets) {
    for (const rule of sheet.rules) {
      if (rule.selectorText === selector_text) {
        return rule;
      }
    }
  }
}
