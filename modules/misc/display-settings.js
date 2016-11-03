// See license.md

'use strict';

const display_settings_chan = new BroadcastChannel('settings');
display_settings_chan.onmessage = function(event) {
  if(event.data === 'changed') {
    display_update_styles();
  }
};

function find_css_rule(sheet, selector_text) {
  return Array.prototype.find.call(sheet.cssRules,(rule) =>
    rule.selectorText === selector_text);
}

function display_update_styles() {

  // Assume a sheet is always available
  const sheet = document.styleSheets[0];

  const entry_rule = find_css_rule(sheet, 'div.entry');
  if(entry_rule) {
    if(localStorage.BACKGROUND_IMAGE) {
      entry_rule.style.backgroundColor = '';
      entry_rule.style.backgroundImage =
        `url(${localStorage.BACKGROUND_IMAGE})`;
    } else if(localStorage.ENTRY_BACKGROUND_COLOR) {
      entry_rule.style.backgroundColor = localStorage.ENTRY_BACKGROUND_COLOR;
      entry_rule.style.backgroundImage = '';
    } else {
      entry_rule.style.backgroundColor = '';
      entry_rule.style.backgroundImage = '';
    }

    const entry_margin = localStorage.ENTRY_MARGIN || '10';
    entry_rule.style.paddingLeft = `${entry_margin}px`;
    entry_rule.style.paddingRight = `${entry_margin}px`;
  }

  const title_rule = find_css_rule(sheet,
    'div.entry a.entry-title');
  if(title_rule) {
    title_rule.style.background = '';
    title_rule.style.fontFamily = localStorage.HEADER_FONT_FAMILY;
    const hfs = parseInt(localStorage.HEADER_FONT_SIZE || '0', 10) || 0;
    if(hfs) {
      title_rule.style.fontSize = (hfs / 10).toFixed(2) + 'em';
    }
  }

  const content_rule = find_css_rule(sheet,
    'div.entry span.entry-content');
  if(content_rule) {
    content_rule.style.background = '';
    content_rule.style.fontFamily = localStorage.BODY_FONT_FAMILY || 'initial';

    const bfs = parseInt(localStorage.BODY_FONT_SIZE || '0', 10);
    if(bfs)
      content_rule.style.fontSize = (bfs / 10).toFixed(2) + 'em';

    content_rule.style.textAlign = (localStorage.JUSTIFY_TEXT === '1') ?
      'justify' : 'left';

    const blh = parseInt(localStorage.BODY_LINE_HEIGHT, 10) || 10;
    content_rule.style.lineHeight = (blh / 10).toFixed(2);
    let col_count = localStorage.COLUMN_COUNT;
    const VALID_COUNTS = { '1': true, '2': true, '3': true };
    if(!(col_count in VALID_COUNTS))
      col_count = '1';
    content_rule.style.webkitColumnCount = col_count;
  }
}

// Dynamically creates new style rules and appends them to the first sheet
function display_load_styles() {
  const sheet = document.styleSheets[0];
  let buffer = [];

  if(localStorage.BACKGROUND_IMAGE)
    buffer.push(`background: url(${localStorage.BACKGROUND_IMAGE});`);
  else if(localStorage.ENTRY_BACKGROUND_COLOR)
    buffer.push(`background: ${localStorage.ENTRY_BACKGROUND_COLOR};`);
  buffer.push('margin:0px;');
  const entry_margin = localStorage.ENTRY_MARGIN;
  if(entry_margin)
    buffer.push(`padding:${entry_margin}px;`);
  sheet.addRule('div.entry', buffer.join(''));

  buffer = [];

  const hfs = parseInt(localStorage.HEADER_FONT_SIZE || '0', 10);
  if(hfs)
    buffer.push(`font-size: ${(hfs / 10).toFixed(2)}em;`);

  const header_font_fam = localStorage.HEADER_FONT_FAMILY;
  if(header_font_fam)
    buffer.push(`font-family:${header_font_fam};`);

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

  // Reset the buffer
  buffer = [];

  const bfs = parseInt(localStorage.BODY_FONT_SIZE || '0', 10);
  if(bfs)
    buffer.push(`font-size: ${(bfs / 10).toFixed(2)}em;`);

  const body_justify = localStorage.JUSTIFY_TEXT === '1';
  if(body_justify)
    buffer.push('text-align: justify;');

  const body_font = localStorage.BODY_FONT_FAMILY;
  if(body_font)
    buffer.push(`font-family:${body_font};`);

  let blh = localStorage.BODY_LINE_HEIGHT;
  if(blh) {
    blh = parseInt(blh);
    if(blh)
      // TODO: units?
      buffer.push(`line-height: ${(blh / 10).toFixed(2)};`);
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
  const col_count = localStorage.COLUMN_COUNT;
  if(col_count === '2' || col_count === '3') {
    buffer.push(`-webkit-column-count: ${col_count};`);
    buffer.push('-webkit-column-gap:30px;');
    buffer.push('-webkit-column-rule:1px outset #AAAAAA;');
  }

  sheet.addRule('div.entry span.entry-content', buffer.join(''));
}
