import * as color from '/src/color/color.js';
import * as rewrite_rules from '/src/config/rewrite-rules.js';
import * as tls from '/src/config/typed-localstorage.js';

// TODO: rather than module methods, consider exporting a Config class. This
// way config is injectable, and thereby more easily mocked in tests.

export function rename(old_name, new_name) {
  return tls.rename(old_name, new_name);
}

export function has_key(key) {
  return tls.has_key(key);
}

export function read_boolean(key) {
  return tls.read_boolean(key);
}

export function write_boolean(key, value) {
  return tls.write_boolean(key, value);
}

export function read_int(key, fallback_value) {
  return tls.read_int(key, fallback_value);
}

export function write_int(key, value) {
  return tls.write_int(key, value);
}

export function read_float(key) {
  return tls.read_float(key);
}

export function write_float(key, value) {
  return tls.write_float(key, value);
}

export function read_string(key) {
  return tls.read_string(key);
}

export function write_string(key, value) {
  return tls.write_string(key, value);
}

export function read_array(key) {
  return tls.read_array(key);
}

export function write_array(key, array) {
  return tls.write_array(key, array);
}

export function remove(key) {
  return tls.remove(key);
}

export function remove_all(keys) {
  return tls.remove_all(keys);
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
  rules.push(rewrite_rules.google_news_rule);
  rules.push(rewrite_rules.techcrunch_rule);
  rules.push(rewrite_rules.facebook_exit_rule);
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
    tls.remove(key);
  }

  tls.rename('LAST_ALARM', 'last_alarm');
  tls.rename(
      'sanitize_document_image_size_fetch_timeout', 'set_image_sizes_timeout');
  tls.rename(
      'sanitize_document_low_contrast_default_matte', 'contrast_default_matte');
  tls.rename('sanitize_document_emphasis_max_length', 'emphasis_max_length');
  tls.rename('sanitize_document_table_scan_max_rows', 'table_scan_max_rows');
  tls.rename('article_title_display_max_length', 'entry_title_max_length');
  tls.rename('MIN_CONTRAST_RATIO', 'min_contrast_ratio');
  tls.rename('PADDING', 'padding');
  tls.rename('BG_IMAGE', 'bg_image');
  tls.rename('BG_COLOR', 'bg_color');
  tls.rename('HEADER_FONT_FAMILY', 'header_font_family');
  tls.rename('HEADER_FONT_SIZE', 'header_font_size');
  tls.rename('BODY_FONT_FAMILY', 'body_font_family');
  tls.rename('BODY_FONT_SIZE', 'body_font_size');
  tls.rename('BODY_LINE_HEIGHT', 'body_line_height');
  tls.rename('JUSTIFY_TEXT', 'justify_text');
  tls.rename('COLUMN_COUNT', 'column_count');
  tls.rename('SHOW_NOTIFICATIONS', 'show_notifications');
  tls.rename('ONLY_POLL_IF_IDLE', 'only_poll_if_idle');

  // Strip old path from bg_image setting
  const path = tls.read_string('bg_image');
  if (path && path.startsWith('/images/')) {
    tls.write_string('bg_image', path.substring('/images/'.length));
  }
}

export function init(event) {
  tls.write_boolean('reuse_newtab', true);
  tls.write_boolean('show_notifications', true);
  tls.write_boolean('only_poll_if_idle', true);
  tls.write_int('idle_poll_secs', 30);
  tls.write_int('contrast_default_matte', color.WHITE);
  tls.write_int('emphasis_max_length', 200);
  tls.write_int('table_scan_max_rows', 20);
  tls.write_float('min_contrast_ratio', 4.5);
  tls.write_int('set_image_sizes_timeout', 300);
  tls.write_int('initial_entry_load_limit', 3);
  tls.write_float('slide_transition_duration', 0.16);
  tls.write_int('padding', 180);
  tls.write_string('bg_color', '#fefdfd');
  tls.write_string('header_font_family', 'Open Sans Regular');
  tls.write_int('header_font_size', 70);
  tls.write_string('body_font_family', 'Edward Tufte Roman');
  tls.write_int('body_font_size', 36);
  tls.write_int('body_line_height', 46);
  tls.write_int('column_count', 1);
  tls.write_boolean('justify_text', false);
  tls.write_array('background_images', background_images);

  // NOTE: this is within an init context, so we disregard any existing value
  // and overwrite the value with the defaults. this will cause any custom
  // registered fonts to no longer exist
  tls.write_array('fonts', default_fonts);
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

  const padding = tls.read_int('padding');
  if (!isNaN(padding)) {
    sheet.addRule('.slide-padding-wrapper', 'padding: ' + padding + 'px');
  }
}

function page_style_entry_rule_create() {
  const buffer = [];

  let path = tls.read_string('bg_image');
  const color = tls.read_string('bg_color');

  if (path) {
    buffer.push(`background: url("/images/${path}");`);
  } else if (color) {
    buffer.push(`background: ${color};`);
  }

  return buffer.join('');
}

function page_style_title_rule_create(sheet) {
  const buffer = [];
  const font_size = tls.read_int('header_font_size');
  if (!isNaN(font_size)) {
    buffer.push(`font-size: ${font_size}px;`);
  }

  const font_family = tls.read_string('header_font_family');
  if (font_family) {
    buffer.push(`font-family: ${font_family};`);
  }

  return buffer.join('');
}

function page_style_content_rule_create(sheet) {
  const buffer = [];
  const font_size = tls.read_int('body_font_size');
  if (!isNaN(font_size)) {
    buffer.push(`font-size: ${font_size}px;`);
  }

  if (tls.read_boolean('justify_text')) {
    buffer.push('text-align: justify;');
  }

  const font_family = tls.read_string('body_font_family');
  if (font_family) {
    buffer.push(`font-family: ${font_family};`);
  }

  const line_height = tls.read_int('body_line_height');
  if (!isNaN(line_height)) {
    buffer.push(`line-height: ${line_height}px;`);
  }

  const column_count = tls.read_int('column_count');
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
