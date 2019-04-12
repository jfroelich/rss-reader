import * as color from '/lib/color.js';

export function rename(oldName, newName) {
  const value = readString(oldName);
  if (typeof value !== 'undefined') {
    writeString(newName, value);
  }
  remove(oldName);
}

export function hasKey(key) {
  return typeof localStorage[key] !== 'undefined';
}

export function readBoolean(key) {
  return typeof localStorage[key] !== 'undefined';
}

export function writeBoolean(key, value) {
  if (value) {
    localStorage[key] = '1';
  } else {
    delete localStorage[key];
  }
}

// TODO: drop support for fallback value
export function readInt(key, fallbackValue) {
  const stringValue = localStorage[key];
  if (stringValue) {
    const integerValue = parseInt(stringValue, 10);
    if (!isNaN(integerValue)) {
      return integerValue;
    }
  }

  if (Number.isInteger(fallbackValue)) {
    return fallbackValue;
  }

  return NaN;
}

export function writeInt(key, value) {
  localStorage[key] = `${value}`;
}

export function readFloat(key) {
  return parseFloat(localStorage[key], 10);
}

export function writeFloat(key, value) {
  localStorage[key] = `${value}`;
}

export function readString(key) {
  return localStorage[key];
}

export function writeString(key, value) {
  localStorage[key] = value;
}

export function readArray(key) {
  const value = localStorage[key];
  return value ? JSON.parse(value) : [];
}

export function writeArray(key, value) {
  localStorage[key] = JSON.stringify(value);
}

export function remove(key) {
  delete localStorage[key];
}

export function removeAll(keys) {
  for (const key of keys) {
    delete localStorage[key];
  }
}

// TODO: eventually figure out how to persist in localStorage
export function getInaccessibleContentDescriptors() {
  return [
    { pattern: /forbes\.com$/i, reason: 'interstitial-advert' },
    { pattern: /productforums\.google\.com$/i, reason: 'script-generated' },
    { pattern: /groups\.google\.com$/i, reason: 'script-generated' },
    { pattern: /nytimes\.com$/i, reason: 'paywall' },
    { pattern: /wsj\.com$/i, reason: 'paywall' },
  ];
}

// TODO: eventually think of how to persist in localStorage
export function getRewriteRules() {
  const rules = [];

  rules.push((url) => {
    if (url.hostname === 'news.google.com' && url.pathname === '/news/url') {
      const param = url.searchParams.get('url');
      try {
        return new URL(param);
      } catch (error) {
        // ignore
      }
    }

    return undefined;
  });

  rules.push((url) => {
    if (url.hostname === 'techcrunch.com' && url.searchParams.has('ncid')) {
      const output = new URL(url.href);
      output.searchParams.delete('ncid');
      return output;
    }

    return undefined;
  });

  rules.push((url) => {
    if (url.hostname === 'l.facebook.com' && url.pathname === '/l.php') {
      const param = url.searchParams.get('u');
      try {
        return new URL(param);
      } catch (error) {
        // ignore
      }
    }

    return undefined;
  });

  return rules;
}

const backgroundImageFilenames = [
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
  'thomas-zucx-noise-lines.png',
];

// Default font names. These must correspond to the names used in CSS.
const defaultFontNames = [
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
  'Roboto Regular',
];

// The extension updated, or the background page was reloaded
export function handleUpdate(event) {
  const deprecatedKeys = [
    'channel_name', 'db_name', 'db_open_timeout', 'db_version', 'debug',
    'entry_title_max_length', 'refresh_badge_delay', 'last_poll_date',
  ];

  for (const key of deprecatedKeys) {
    remove(key);
  }

  rename('LAST_ALARM', 'last_alarm');
  rename('sanitize_document_image_size_fetch_timeout', 'set_image_sizes_timeout');
  rename('sanitize_document_low_contrast_default_matte', 'contrast_default_matte');
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
  const path = readString('bg_image');
  if (path && path.startsWith('/images/')) {
    writeString('bg_image', path.substring('/images/'.length));
  }
}

export function init(event) {
  writeBoolean('reuse_newtab', true);
  writeBoolean('notifications_enabled', true);
  writeBoolean('only_poll_if_idle', true);
  writeInt('idle_poll_secs', 30);
  writeInt('contrast_default_matte', color.WHITE);
  writeInt('emphasis_max_length', 200);
  writeInt('table_scan_max_rows', 20);
  writeFloat('min_contrast_ratio', 4.5);
  writeInt('set_image_sizes_timeout', 300);
  writeInt('initial_entry_load_limit', 3);
  writeFloat('slide_transition_duration', 0.16);
  writeInt('padding', 180);
  writeString('bg_color', '#fefdfd');
  writeString('header_font_family', 'Open Sans Regular');
  writeInt('header_font_size', 70);
  writeString('body_font_family', 'Edward Tufte Roman');
  writeInt('body_font_size', 36);
  writeInt('body_line_height', 46);
  writeInt('column_count', 1);
  writeBoolean('justify_text', false);
  writeArray('backgroundImageFilenames', backgroundImageFilenames);

  // NOTE: this is within an init context, so we disregard any existing value
  // and overwrite the value with the defaults. this will cause any custom
  // registered fonts to no longer exist
  writeArray('fonts', defaultFontNames);
}

// React to a localStorage property change. Note that this is only fired by the
// browser when another page changes local storage. If a local change is made
// and there is a desire for the same page to hear it, then the caller must
// call this directly with a fake event or something like this:
// https://stackoverflow.com/questions/26974084
// Note this event listener should only be bound by a page where the appropriate
// stylesheets are loaded. This assumes those stylesheets exist.
export function storageOnchange(event) {
  if (!event.isTrusted || event.type !== 'storage') {
    return;
  }

  const { key } = event;
  if (key === 'padding') {
    const rule = findCSSRule('.slide-padding-wrapper');
    const padding = parseInt(event.newValue, 10);
    rule.style.padding = isNaN(padding) ? '' : `${padding}px`;
    return;
  }

  if (key === 'bg_image') {
    const rule = findCSSRule('.entry');
    const path = event.newValue;
    rule.style.backgroundImage = path ? `url("/images/${path}")` : '';
    return;
  }

  if (key === 'bg_color') {
    const rule = findCSSRule('.entry');
    const color = event.newValue;
    rule.style.backgroundColor = color || '';
    return;
  }

  if (key === 'header_font_family') {
    const rule = findCSSRule('.entry .entry-title');
    const family = event.newValue;
    rule.style.fontFamily = family || 'initial';
    return;
  }

  if (key === 'header_font_size') {
    const rule = findCSSRule('.entry .entry-title');
    const size = parseInt(event.newValue, 10);
    rule.style.fontSize = isNaN(size) ? '' : `${size}px`;
    return;
  }

  if (key === 'body_font_family') {
    const rule = findCSSRule('.entry .entry-content');
    const family = event.newValue;
    rule.style.fontFamily = family || 'initial';
    return;
  }

  if (key === 'body_font_size') {
    const rule = findCSSRule('.entry .entry-content');
    const size = parseInt(event.newValue, 10);
    rule.style.fontSize = isNaN(size) ? '' : `${size}px`;
    return;
  }

  if (key === 'justify_text') {
    const rule = findCSSRule('.entry .entry-content');
    rule.style.textAlign = event.newValue ? 'justify' : 'left';
    return;
  }

  if (key === 'body_line_height') {
    const rule = findCSSRule('.entry .entry-content');
    const height = parseInt(event.newValue, 10);
    rule.style.lineHeight = isNaN(height) ? '' : `${height}px`;
    return;
  }

  if (key === 'column_count') {
    const rule = findCSSRule('.entry .entry-content');
    const count = parseInt(event.newValue, 10);
    if (!isNaN(count) && count >= 0 && count <= 3) {
      rule.style.columnCount = count;
    } else {
      rule.style.columnCount = '';
    }
  }
}

// Initialize the dom with css settings from config.
export function domLoadListener() {
  const sheet = document.styleSheets[0];
  sheet.addRule('.entry', pageStyleCreateEntryRule());
  sheet.addRule('.entry .entry-title', pageStyleCreateTitleRule());
  sheet.addRule('.entry .entry-content', pageStyleCreateContentRule());

  const padding = readInt('padding');
  if (!isNaN(padding)) {
    sheet.addRule('.slide-padding-wrapper', `padding: ${padding}px`);
  }
}

function pageStyleCreateEntryRule() {
  const buffer = [];

  const path = readString('bg_image');
  const backgroundColor = readString('bg_color');

  if (path) {
    buffer.push(`background: url("/images/${path}");`);
  } else if (backgroundColor) {
    buffer.push(`background: ${backgroundColor};`);
  }

  return buffer.join('');
}

function pageStyleCreateTitleRule(sheet) {
  const buffer = [];
  const fontSize = readInt('header_font_size');
  if (!isNaN(fontSize)) {
    buffer.push(`font-size: ${fontSize}px;`);
  }

  const fontFamily = readString('header_font_family');
  if (fontFamily) {
    buffer.push(`font-family: ${fontFamily};`);
  }

  return buffer.join('');
}

function pageStyleCreateContentRule(sheet) {
  const buffer = [];
  const fontSize = readInt('body_font_size');
  if (!isNaN(fontSize)) {
    buffer.push(`font-size: ${fontSize}px;`);
  }

  if (readBoolean('justify_text')) {
    buffer.push('text-align: justify;');
  }

  const fontFamily = readString('body_font_family');
  if (fontFamily) {
    buffer.push(`font-family: ${fontFamily};`);
  }

  const lineHeight = readInt('body_line_height');
  if (!isNaN(lineHeight)) {
    buffer.push(`line-height: ${lineHeight}px;`);
  }

  const columnCount = readInt('column_count');
  if (columnCount === 2 || columnCount === 3) {
    buffer.push(`column-count: ${columnCount};`);
    buffer.push('column-gap: 30px;');
    buffer.push('column-rule: 1px outset #aaaaaa;');
  }

  return buffer.join('');
}

// Returns the first matching css rule or undefined
// @param selectorText {String}
// @return {CSSStyleRule}
function findCSSRule(selectorText) {
  for (const sheet of document.styleSheets) {
    for (const rule of sheet.rules) {
      if (rule.selectorText === selectorText) {
        return rule;
      }
    }
  }

  return undefined;
}
