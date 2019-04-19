import * as config from '/src/config.js';

export default function ThemeControl() { }

ThemeControl.prototype.init = function () {
  addEventListener('storage', this.storageOnchange.bind(this));

  // Create the dynamic rules based on properties loaded from config
  const sheet = document.styleSheets[0];
  sheet.addRule('.entry', createEntryRule());
  sheet.addRule('.entry .entry-title', createTitleRule());
  sheet.addRule('.entry .entry-content', createContentRule());

  const padding = config.readInt('padding');
  if (!isNaN(padding)) {
    sheet.addRule('.slide-padding-wrapper', `padding: ${padding}px`);
  }
};

// React to a localStorage property change. Note that this is only fired when another page changes
// local storage. If a local change is made and there is a desire for the same page to hear it, then
// the caller must call this directly with a fake event or something like this:
// https://stackoverflow.com/questions/26974084. Note this event listener should only be bound by a
// page where the appropriate stylesheets are loaded. This assumes those stylesheets exist.
ThemeControl.prototype.storageOnchange = function (event) {
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
};

function createEntryRule() {
  const buffer = [];

  const path = config.readString('bg_image');
  const backgroundColor = config.readString('bg_color');

  if (path) {
    buffer.push(`background: url("/images/${path}");`);
  } else if (backgroundColor) {
    buffer.push(`background: ${backgroundColor};`);
  }

  return buffer.join('');
}

function createTitleRule() {
  const buffer = [];
  const fontSize = config.readInt('header_font_size');
  if (!isNaN(fontSize)) {
    buffer.push(`font-size: ${fontSize}px;`);
  }

  const fontFamily = config.readString('header_font_family');
  if (fontFamily) {
    buffer.push(`font-family: ${fontFamily};`);
  }

  return buffer.join('');
}

function createContentRule() {
  const buffer = [];
  const fontSize = config.readInt('body_font_size');
  if (!isNaN(fontSize)) {
    buffer.push(`font-size: ${fontSize}px;`);
  }

  if (config.readBoolean('justify_text')) {
    buffer.push('text-align: justify;');
  }

  const fontFamily = config.readString('body_font_family');
  if (fontFamily) {
    buffer.push(`font-family: ${fontFamily};`);
  }

  const lineHeight = config.readInt('body_line_height');
  if (!isNaN(lineHeight)) {
    buffer.push(`line-height: ${lineHeight}px;`);
  }

  const columnCount = config.readInt('column_count');
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
