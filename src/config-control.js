import * as color from '/src/color.js';
import * as config from '/src/config.js';

// React to the extension being installed or updated, or when chrome is updated,
// to do config related things. Note that this listener should be bound before
// other listeners that depend on configuration setup.
export function install_listener(event) {
  if (event.reason === 'install') {
    init_config(event);
  } else {
    update_config(event);
  }
}

function update_config(event) {
  // Remove deprecated keys
  // TODO: should just have an array and iterate over it
  config.remove('debug');
  config.remove('refresh_badge_delay');
  config.remove('db_name');
  config.remove('db_version');
  config.remove('db_open_timeout');
  config.remove('channel_name');

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
  rename('SHOW_NOTIFICATIONS', 'show_notifications');
  rename('ONLY_POLL_IF_IDLE', 'only_poll_if_idle');

  // In some unknown prior version of the extension, I stored the path prefix
  // in the images array. This is no longer done, so check if the stored value
  // still has the path and if so remove it.
  const path = config.read_string('bg_image');
  if (path && path.startsWith('/images/')) {
    console.debug('Stripping /images/ from bg image path', path);
    config.write_string('bg_image', path.substring('/images/'.length));
  }
}

export function init_config(event) {
  // General settings
  config.write_boolean('reuse_newtab', true);
  config.write_boolean('show_notifications', true);

  // Poll settings
  config.write_boolean('only_poll_if_idle', true);

  // Content filter settings
  config.write_int('contrast_default_matte', color.WHITE);
  config.write_int('emphasis_max_length', 200);
  config.write_int('table_scan_max_rows', 20);
  config.write_float('min_contrast_ratio', 4.5);
  config.write_int('set_image_sizes_timeout', 300);
  config.write_int('initial_entry_load_limit', 3);

  // View settings
  config.write_int('entry_title_max_length', 300);
  config.write_int('padding', 180);
  config.write_string('bg_color', '#fefdfd');
  config.write_string('header_font_family', 'Open Sans Regular');
  config.write_int('header_font_size', 70);
  config.write_string('body_font_family', 'Edward Tufte Roman');
  config.write_int('body_font_size', 36);
  config.write_int('body_line_height', 46);
  config.write_int('column_count', 1);
  config.write_boolean('justify_text', false);

  // Install default background images
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
  config.write_array('background_images', background_images);

  install_fonts();
}

export function install_fonts() {
  // Install default fonts
  // clang-format off
  const fonts = [
    'ArchivoNarrow-Regular',
    'Arial',
    'Calibri',
    'Cambria',
    'CartoGothicStd',
    'Edward Tufte Roman',
    'Fanwood',
    'Georgia',
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
  config.write_array('fonts', fonts);
}

// Rename a configuration key.
// TODO: this belongs in config.js, not here
function rename(from, to) {
  // There is no need to do any type coercion. Maintain fidelity by using the
  // string type, because everything in and out of config is derivative of
  // of the string type.
  const value = config.read_string(from);

  // Avoid creating the new key if the value is undefined. If the value is
  // undefined then rename devolves into a remove decorator. Note that due to
  // the strictness of this check, empty strings are retained, even though they
  // are not visibly different from undefined in devtools
  if (typeof value !== 'undefined') {
    config.write_string(to, value);
  }

  config.remove(from);
}

// TODO: this is a violation of the config.js abstraction. That is supposed
// to abstract away how configuration is stored. So we have a design flaw here.
// This is not supposed to know about local storage.

// React to a localStorage property change. Note that this is only fired by the
// browser when another page changes local storage. If a local change is made
// and there is a desire for the same page to hear it, then the caller must
// call this directly with a fake event or something like this:
// https://stackoverflow.com/questions/26974084
// Note this event listener should only be bound by a page where the appropriate
// stylesheets are loaded. This assumes those stylesheets exist.
export function storage_onchange(event) {
  // TODO: do not use units for 0? maybe that is dumb
  // TODO: review https://developers.google.com/web/updates/2018/03/cssom

  if (!event.isTrusted) {
    console.warn('Untrusted event', event);
    return;
  }

  if (event.type !== 'storage') {
    console.debug('Ignoring non-storage event', event);
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
      rule.style.webkitColumnCount = count;
    } else {
      rule.style.webkitColumnCount = '';
    }
  }
}

// Initialize the dom with css settings from config. This should only be bound
// if stylesheets are present, and to an event later than DOMContentLoaded.
export function dom_load_listener() {
  const sheet = document.styleSheets[0];
  sheet.addRule('.entry', page_style_entry_rule_create());
  sheet.addRule('.entry .entry-title', page_style_title_rule_create());
  sheet.addRule('.entry .entry-content', page_style_content_rule_create());

  const padding = config.read_int('padding');
  if (!isNaN(padding)) {
    sheet.addRule('.slide-padding-wrapper', 'padding: ' + padding + 'px');
  }
}

function page_style_entry_rule_create() {
  const buffer = [];

  let path = config.read_string('bg_image');
  const color = config.read_string('bg_color');

  if (path) {
    buffer.push(`background: url("/images/${path}");`);
  } else if (color) {
    buffer.push(`background: ${color};`);
  }

  return buffer.join('');
}

function page_style_title_rule_create(sheet) {
  const buffer = [];
  const font_size = config.read_int('header_font_size');
  if (!isNaN(font_size)) {
    buffer.push(`font-size: ${font_size}px;`);
  }

  const font_family = config.read_string('header_font_family');
  if (font_family) {
    buffer.push(`font-family: ${font_family};`);
  }

  return buffer.join('');
}

function page_style_content_rule_create(sheet) {
  const buffer = [];
  const font_size = config.read_int('body_font_size');
  if (!isNaN(font_size)) {
    buffer.push(`font-size: ${font_size}px;`);
  }

  if (config.read_boolean('justify_text')) {
    buffer.push('text-align: justify;');
  }

  const font_family = config.read_string('body_font_family');
  if (font_family) {
    buffer.push(`font-family: ${font_family};`);
  }

  const line_height = config.read_int('body_line_height');
  if (!isNaN(line_height)) {
    buffer.push(`line-height: ${line_height}px;`);
  }

  // TODO: did column-count become standard css yet? if so drop prefix
  const column_count = config.read_int('column_count');
  if (column_count === 2 || column_count === 3) {
    buffer.push(`-webkit-column-count: ${column_count};`);
    buffer.push('-webkit-column-gap: 30px;');
    buffer.push('-webkit-column-rule: 1px outset #aaaaaa;');
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
