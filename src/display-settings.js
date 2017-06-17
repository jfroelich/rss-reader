// See license.md

'use strict';

// TODO: rename to style.js

var jr = jr || {};
jr.style = {};


// Create a style channel that persists for duration of page
// TODO: use a better channel name, prefix for less likely conflict
jr.style.channel = new BroadcastChannel('settings');
jr.style.channel.onmessage = function(event) {
  if(event.data === 'changed') {
    jr.style.onChange(event);
  }
};

// TODO: inline the iteration, try for..of
jr.style.findCSSRule = function(sheet, selectorText) {
  return Array.prototype.find.call(sheet.cssRules,(rule) =>
    rule.selectorText === selectorText);
};

// TODO: break up into helper functions
// TODO: camelcase
jr.style.onChange = function(event) {

    // Assume a sheet is always available
    const sheet = document.styleSheets[0];

    const entry_rule = jr.style.findCSSRule(sheet, 'div.entry');
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

      const entryMargin = localStorage.ENTRY_MARGIN || '10';
      entry_rule.style.paddingLeft = `${entryMargin}px`;
      entry_rule.style.paddingRight = `${entryMargin}px`;
    }

    const title_rule = jr.style.findCSSRule(sheet,
      'div.entry a.entry-title');
    if(title_rule) {
      title_rule.style.background = '';
      title_rule.style.fontFamily = localStorage.HEADER_FONT_FAMILY;
      const hfs = parseInt(localStorage.HEADER_FONT_SIZE || '0', 10) || 0;
      if(hfs) {
        title_rule.style.fontSize = (hfs / 10).toFixed(2) + 'em';
      }
    }

    const content_rule = jr.style.findCSSRule(sheet,
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
      let colCount = localStorage.COLUMN_COUNT;
      const VALID_COUNTS = { '1': true, '2': true, '3': true };
      if(!(colCount in VALID_COUNTS))
        colCount = '1';
      content_rule.style.webkitColumnCount = colCount;
    }
};

jr.style.getStyleSheet = function() {
  // Use the first sheet
  return document.styleSheets[0];
};

// Appends new style rules to the document's style sheet
jr.style.onLoad = function() {
  const sheet = jr.style.getStyleSheet();
  let buffer = [];

  if(localStorage.BACKGROUND_IMAGE)
    buffer.push(`background: url(${localStorage.BACKGROUND_IMAGE});`);
  else if(localStorage.ENTRY_BACKGROUND_COLOR)
    buffer.push(`background: ${localStorage.ENTRY_BACKGROUND_COLOR};`);
  buffer.push('margin:0px;');
  const entryMargin = localStorage.ENTRY_MARGIN;
  if(entryMargin)
    buffer.push(`padding:${entryMargin}px;`);
  sheet.addRule('div.entry', buffer.join(''));

  buffer = [];

  const hfs = parseInt(localStorage.HEADER_FONT_SIZE || '0', 10);
  if(hfs)
    buffer.push(`font-size: ${(hfs / 10).toFixed(2)}em;`);

  const headerFontFam = localStorage.HEADER_FONT_FAMILY;
  if(headerFontFam)
    buffer.push(`font-family:${headerFontFam};`);

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

  buffer = [];

  const bfs = parseInt(localStorage.BODY_FONT_SIZE || '0', 10);
  if(bfs)
    buffer.push(`font-size: ${(bfs / 10).toFixed(2)}em;`);

  const bodyJustify = localStorage.JUSTIFY_TEXT === '1';
  if(bodyJustify)
    buffer.push('text-align: justify;');

  const bodyFont = localStorage.BODY_FONT_FAMILY;
  if(bodyFont)
    buffer.push(`font-family:${bodyFont};`);

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
  const colCount = localStorage.COLUMN_COUNT;
  if(colCount === '2' || colCount === '3') {
    buffer.push(`-webkit-column-count: ${colCount};`);
    buffer.push('-webkit-column-gap:30px;');
    buffer.push('-webkit-column-rule:1px outset #AAAAAA;');
  }

  sheet.addRule('div.entry span.entry-content', buffer.join(''));
};
