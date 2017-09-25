'use strict';

{ // Begin file block scope

// Get the current settings from local storage and then modify the css rules
// in the default style sheet
function update_entry_css_rules(event) {
  const sheet = get_default_stylesheet();
  update_entry_css_rule(sheet);
  update_entry_title_css_rule(sheet);
  update_entry_content_css_rule(sheet);
}

// Get the current settings from local storage and then create css rules and
// append them to the default style sheet.
function add_entry_css_rules() {
  const sheet = get_default_stylesheet();
  add_entry_css_rule(sheet);
  add_entry_title_css_rule(sheet);
  add_entry_content_css_rule(sheet);
}

function add_entry_css_rule(sheet) {
  let buffer = [];
  if(localStorage.BACKGROUND_IMAGE)
    buffer.push(`background: url(${localStorage.BACKGROUND_IMAGE});`);
  else if(localStorage.ENTRY_BACKGROUND_COLOR)
    buffer.push(`background: ${localStorage.ENTRY_BACKGROUND_COLOR};`);

  // TODO: top/bottom margin works when initializing but not when changing

  buffer.push('margin:0px;');
  const entry_margin = localStorage.ENTRY_MARGIN;
  if(entry_margin)
    buffer.push(`padding:${entry_margin}px;`);
  sheet.addRule('div.entry', buffer.join(''));
}

function add_entry_title_css_rule(sheet) {
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
  buffer.push('margin:0px');
  buffer.push('padding:0px');
  sheet.addRule('div.entry a.entry-title', buffer.join(''));
}

function add_entry_content_css_rule(sheet) {
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

  buffer.push('vertical-align:text-top;');
  buffer.push('display:block;');
  buffer.push('word-wrap:break-word;');
  buffer.push('padding-top:20px;');
  buffer.push('padding-right:0px;');
  buffer.push('padding-left:0px;');
  buffer.push('padding-bottom:20px;');
  buffer.push('margin:0px;');

  // TODO: use this if columns enabled (use 1(none), 2, 3 as options).
  const column_count_string = localStorage.COLUMN_COUNT;
  if(column_count_string === '2' || column_count_string === '3') {
    buffer.push(`-webkit-column-count: ${column_count_string};`);
    buffer.push('-webkit-column-gap:30px;');
    buffer.push('-webkit-column-rule:1px outset #AAAAAA;');
  }

  sheet.addRule('div.entry span.entry-content', buffer.join(''));
}

// Use the first sheet, assume it always exists
function get_default_stylesheet() {
  return document.styleSheets[0];
}

function find_css_rule(sheet, selector_text) {
  for(const css_rule of sheet.cssRules)
    if(css_rule.selectorText === selector_text)
      return css_rule;
}

function update_entry_css_rule(sheet) {
  const entry_rule = find_css_rule(sheet, 'div.entry');
  if(!entry_rule)
    return;

  if(localStorage.BACKGROUND_IMAGE) {
    entry_rule.style.backgroundColor = '';
    entry_rule.style.backgroundImage = `url(${localStorage.BACKGROUND_IMAGE})`;
  } else if(localStorage.ENTRY_BACKGROUND_COLOR) {
    entry_rule.style.backgroundColor = localStorage.ENTRY_BACKGROUND_COLOR;
    entry_rule.style.backgroundImage = '';
  } else {
    entry_rule.style.backgroundColor = '';
    entry_rule.style.backgroundImage = '';
  }

  const entry_margin = localStorage.ENTRY_MARGIN || '0';
  if(entry_margin) {
    // TODO: just set padding? why is this being done this way?
    const formatted_margin = `${entry_margin}px`;
    entry_rule.style.paddingTop = formatted_margin;
    entry_rule.style.paddingBottom = formatted_margin;
    entry_rule.style.paddingLeft = formatted_margin;
    entry_rule.style.paddingRight = formatted_margin;
  }
}

function update_entry_title_css_rule(sheet) {
  const title_rule = find_css_rule(sheet, 'div.entry a.entry-title');
  if(title_rule) {
    title_rule.style.background = '';
    title_rule.style.fontFamily = localStorage.HEADER_FONT_FAMILY;
    const header_font_size = parseInt(
      localStorage.HEADER_FONT_SIZE || '0', 10) || 0;
    if(header_font_size)
      title_rule.style.fontSize = (header_font_size / 10).toFixed(2) + 'em';
  }
}

function update_entry_content_css_rule(sheet) {
  const rule = find_css_rule(sheet, 'div.entry span.entry-content');
  if(!rule)
    return;

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

// Globals
this.update_entry_css_rules = update_entry_css_rules;
this.add_entry_css_rules = add_entry_css_rules;

} // End file block scope
