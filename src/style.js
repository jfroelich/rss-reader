// See license.md

'use strict';

{ // Begin file block scope

// Get the current settings from local storage and then modify the css rules
// in the default style sheet
function updateEntryCSSRules(event) {
  const sheet = getDefaultStyleSheet();
  updateEntryCSSRule(sheet);
  updateEntryTitleCSSRule(sheet);
  updateEntryContentCSSRule(sheet);
}
this.updateEntryCSSRules = updateEntryCSSRules;

// Get the current settings from local storage and then create css rules and
// append them to the default style sheet.
function addEntryCSSRules() {
  const sheet = getDefaultStyleSheet();
  addEntryCSSRule(sheet);
  addEntryTitleCSSRule(sheet);
  addEntryContentCSSRule(sheet);
}
this.addEntryCSSRules = addEntryCSSRules;

function addEntryCSSRule(sheet) {
  let buffer = [];
  if(localStorage.BACKGROUND_IMAGE) {
    buffer.push(`background: url(${localStorage.BACKGROUND_IMAGE});`);
  } else if(localStorage.ENTRY_BACKGROUND_COLOR) {
    buffer.push(`background: ${localStorage.ENTRY_BACKGROUND_COLOR};`);
  }
  buffer.push('margin:0px;');
  const entryMargin = localStorage.ENTRY_MARGIN;
  if(entryMargin) {
    buffer.push(`padding:${entryMargin}px;`);
  }
  sheet.addRule('div.entry', buffer.join(''));
}

function addEntryTitleCSSRule(sheet) {
  let buffer = [];
  const headerFontSize = parseInt(localStorage.HEADER_FONT_SIZE || '0', 10);
  if(headerFontSize) {
    buffer.push(`font-size: ${(headerFontSize / 10).toFixed(2)}em;`);
  }

  const headerFont = localStorage.HEADER_FONT_FAMILY;
  if(headerFont) {
    buffer.push(`font-family:${headerFont};`);
  }

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

function addEntryContentCSSRule(sheet) {
  let buffer = [];
  const bodyFontSize = parseInt(localStorage.BODY_FONT_SIZE || '0', 10);
  if(bodyFontSize) {
    buffer.push(`font-size: ${(bodyFontSize / 10).toFixed(2)}em;`);
  }

  const bodyJustify = localStorage.JUSTIFY_TEXT === '1';
  if(bodyJustify) {
    buffer.push('text-align: justify;');
  }

  const bodyFont = localStorage.BODY_FONT_FAMILY;
  if(bodyFont) {
    buffer.push(`font-family:${bodyFont};`);
  }

  let bodyLineHeight = localStorage.BODY_LINE_HEIGHT;
  if(bodyLineHeight) {
    bodyLineHeight = parseInt(bodyLineHeight, 10);

    // TODO: units?
    if(bodyLineHeight) {
      buffer.push(`line-height: ${(bodyLineHeight / 10).toFixed(2)};`);
    }
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
  const columnCount = localStorage.COLUMN_COUNT;
  if(columnCount === '2' || columnCount === '3') {
    buffer.push(`-webkit-column-count: ${columnCount};`);
    buffer.push('-webkit-column-gap:30px;');
    buffer.push('-webkit-column-rule:1px outset #AAAAAA;');
  }

  sheet.addRule('div.entry span.entry-content', buffer.join(''));
}

// Use the first sheet, assume it always exists
function getDefaultStyleSheet() {
  return document.styleSheets[0];
}

function findCSSRule(sheet, selectorText) {
  for(let rule of sheet.cssRules) {
    if(rule.selectorText === selectorText) {
      return rule;
    }
  }
}

function updateEntryCSSRule(sheet) {
  const entryRule = findCSSRule(sheet, 'div.entry');
  if(!entryRule) {
    return;
  }

  if(localStorage.BACKGROUND_IMAGE) {
    entryRule.style.backgroundColor = '';
    entryRule.style.backgroundImage = `url(${localStorage.BACKGROUND_IMAGE})`;
  } else if(localStorage.ENTRY_BACKGROUND_COLOR) {
    entryRule.style.backgroundColor = localStorage.ENTRY_BACKGROUND_COLOR;
    entryRule.style.backgroundImage = '';
  } else {
    entryRule.style.backgroundColor = '';
    entryRule.style.backgroundImage = '';
  }

  const entryMargin = localStorage.ENTRY_MARGIN || '10';
  entryRule.style.paddingLeft = `${entryMargin}px`;
  entryRule.style.paddingRight = `${entryMargin}px`;
}

function updateEntryTitleCSSRule(sheet) {
  const titleRule = findCSSRule(sheet, 'div.entry a.entry-title');
  if(titleRule) {
    titleRule.style.background = '';
    titleRule.style.fontFamily = localStorage.HEADER_FONT_FAMILY;
    const headerFontSize = parseInt(localStorage.HEADER_FONT_SIZE || '0', 10) || 0;
    if(headerFontSize) {
      titleRule.style.fontSize = (headerFontSize / 10).toFixed(2) + 'em';
    }
  }
}

function updateEntryContentCSSRule(sheet) {
  const rule = findCSSRule(sheet, 'div.entry span.entry-content');
  if(!rule) {
    return;
  }

  rule.style.background = '';

  const bodyFont = localStorage.BODY_FONT_FAMILY;
  if(bodyFont) {
    rule.style.fontFamily = bodyFont;
  } else {
    rule.style.fontFamily = 'initial';
  }

  const bodyFontSizeString = localStorage.BODY_FONT_SIZE;
  if(bodyFontSizeString) {
    const bodyFontSizeNumber = parseInt(bodyFontSizeString, 10);
    if(bodyFontSizeNumber) {
      // Why am I dividing by 10 here??
      // Why am I using em?
      // What is the base font?
      rule.style.fontSize = (bodyFontSizeNumber / 10).toFixed(2) + 'em';
    }
  }

  rule.style.textAlign = (localStorage.JUSTIFY_TEXT === '1') ?
    'justify' : 'left';

  const bodyLineHeight = parseInt(localStorage.BODY_LINE_HEIGHT, 10) || 10;
  rule.style.lineHeight = (bodyLineHeight / 10).toFixed(2);
  let columnCount = localStorage.COLUMN_COUNT;
  const validCountObject = { '1': true, '2': true, '3': true };
  if(!(columnCount in validCountObject)) {
    columnCount = '1';
  }
  rule.style.webkitColumnCount = columnCount;
}

} // End file block scope
