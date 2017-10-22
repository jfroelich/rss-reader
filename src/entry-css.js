'use strict';

const ENTRY_CSS_DEBUG = false;

// Get the current settings from local storage and then modify the css rules
// in the default style sheet
function entry_css_on_change(event) {

  if(ENTRY_CSS_DEBUG) {
    DEBUG('entry css settings changed');
  }

  const sheet = css_get_default_sheet();
  console.assert(sheet);
  entry_css_update_rule(sheet);
  entry_css_update_title_rule(sheet);
  entry_css_update_content_rule(sheet);
}

// Get the current settings from local storage and then create css rules and
// append them to the default style sheet.
function entry_css_init() {

  if(ENTRY_CSS_DEBUG) {
    DEBUG('initializing entry css settings');
  }

  const sheet = css_get_default_sheet();
  console.assert(sheet);
  sheet.addRule('div.entry', entry_css_create_entry_rule_text());

  // TODO: convert these two to be live above statement

  entry_css_add_title_rule(sheet);
  entry_css_add_content_rule(sheet);
}

function entry_css_create_entry_rule_text() {
  const buffer = [];

  buffer.push('margin: 0px;');

  const path = localStorage.BG_IMAGE;
  const color = localStorage.BG_COLOR;

  if(path) {
    buffer.push(`background: url("${path}");`);
  } else if(color) {
    buffer.push(`background: ${color};`);
  }

  const padding = localStorage.PADDING;
  if(padding) {
    buffer.push(`padding: ${padding}px;`);
  }

  if(ENTRY_CSS_DEBUG) {
    DEBUG('div.entry:', buffer.join(''));
  }

  return buffer.join('');
}

function entry_css_add_title_rule(sheet) {
  let buffer = [];
  const header_font_size = parseInt(localStorage.HEADER_FONT_SIZE || '0', 10);
  if(header_font_size)
    buffer.push(`font-size: ${(header_font_size / 10).toFixed(2)}em;`);

  const header_font_family = localStorage.HEADER_FONT_FAMILY;
  if(header_font_family)
    buffer.push(`font-family:${header_font_family};`);

  buffer.push('letter-spacing:-0.03em;');
  buffer.push('color:rgba(50, 50, 50, 0.9);');
  buffer.push('text-decoration:none;');
  buffer.push('display:block;');
  buffer.push('word-wrap: break-word;');
  buffer.push('text-shadow: 1px 1px 2px #cccccc;');
  buffer.push('text-transform: capitalize;');
  buffer.push('margin: 0px');
  buffer.push('padding:0px');
  sheet.addRule('div.entry a.entry-title', buffer.join(''));
}

function entry_css_add_content_rule(sheet) {
  let buffer = [];
  const body_font_size = parseInt(localStorage.BODY_FONT_SIZE || '0', 10);
  if(body_font_size)
    buffer.push(`font-size: ${(body_font_size / 10).toFixed(2)}em;`);

  const body_justify_text = localStorage.JUSTIFY_TEXT === '1';
  if(body_justify_text)
    buffer.push('text-align: justify;');

  const body_font_family = localStorage.BODY_FONT_FAMILY;
  if(body_font_family)
    buffer.push(`font-family:${body_font_family};`);

  let body_line_height_string = localStorage.BODY_LINE_HEIGHT;
  if(body_line_height_string) {
    const body_line_height = parseInt(body_line_height_string, 10);

    // TODO: units?
    if(body_line_height)
      buffer.push(`line-height: ${(body_line_height / 10).toFixed(2)};`);
  }

  buffer.push('vertical-align: text-top;');
  buffer.push('display: block;');
  buffer.push('word-wrap: break-word;');
  buffer.push('padding-top: 20px;');
  buffer.push('padding-right: 0px;');
  buffer.push('padding-left: 0px;');
  buffer.push('padding-bottom: 20px;');
  buffer.push('margin: 0px;');

  const column_count = localStorage.COLUMN_COUNT;
  if(column_count === '2' || column_count === '3') {
    buffer.push(`-webkit-column-count: ${column_count};`);
    buffer.push('-webkit-column-gap: 30px;');
    buffer.push('-webkit-column-rule: 1px outset #AAAAAA;');
  }

  sheet.addRule('div.entry span.entry-content', buffer.join(''));
}

function entry_css_update_rule(sheet) {
  console.assert(sheet);
  const rule = css_find_rule(sheet, 'div.entry');
  console.assert(rule);
  const style = rule.style;

  const path = localStorage.BG_IMAGE;
  const color = localStorage.BG_COLOR;

  if(path) {
    style.backgroundColor = '';
    style.backgroundImage = `url("${path}")`;
  } else if(color) {
    style.backgroundColor = color;
    style.backgroundImage = '';
  } else {
    style.backgroundColor = '';
    style.backgroundImage = '';
  }

  const padding = localStorage.PADDING || '0';
  style.padding = `${padding}px`;
}

function entry_css_update_title_rule(sheet) {
  console.assert(sheet);
  const rule = css_find_rule(sheet, 'div.entry a.entry-title');
  console.assert(rule);
  const style = rule.style;

  style.background = '';
  style.fontFamily = localStorage.HEADER_FONT_FAMILY;

  const size = parseInt(localStorage.HEADER_FONT_SIZE, 10);
  if(!isNaN(size)) {
    style.fontSize = (size / 10).toFixed(2) + 'em';
  }
}

function entry_css_update_content_rule(sheet) {
  console.assert(sheet);
  const rule = css_find_rule(sheet, 'div.entry span.entry-content');
  console.assert(rule);

  rule.style.background = '';

  const body_font_family = localStorage.BODY_FONT_FAMILY;
  if(body_font_family)
    rule.style.fontFamily = body_font_family;
  else
    rule.style.fontFamily = 'initial';

  const body_font_size_string = localStorage.BODY_FONT_SIZE;
  if(body_font_size_string) {
    const radix = 10;
    const body_font_size_number = parseInt(body_font_size_string, radix);

    // Why am I dividing by 10 here??
    // Why am I using em?
    // What is the base font?
    if(body_font_size_number)
      rule.style.fontSize = (body_font_size_number / 10).toFixed(2) + 'em';
  }

  rule.style.textAlign = (localStorage.JUSTIFY_TEXT === '1') ?
    'justify' : 'left';

  const body_line_height = parseInt(localStorage.BODY_LINE_HEIGHT, 10) || 10;
  rule.style.lineHeight = (body_line_height / 10).toFixed(2);
  let column_count_string = localStorage.COLUMN_COUNT;
  const valid_counts = { '1': true, '2': true, '3': true };
  if(!(column_count_string in valid_counts))
    column_count_string = '1';
  rule.style.webkitColumnCount = column_count_string;
}
