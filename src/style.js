// See license.md

'use strict';

const styleChannel = new BroadcastChannel('settings');
styleChannel.onmessage = function(event) {
  if(event.data === 'changed') {
    styleOnChange(event);
  }
};

function styleFindCSSRule(sheet, selectorText) {
  for(let ruleObject of sheet.cssRules) {
    if(ruleObject.selectorText === selectorText) {
      return ruleObject;
    }
  }
}

function styleUpdateEntryRule(sheet) {
  const entryRule = styleFindCSSRule(sheet, 'div.entry');
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

function styleUpdateTitleRule(sheet) {
  const titleRule = styleFindCSSRule(sheet, 'div.entry a.entry-title');
  if(titleRule) {
    titleRule.style.background = '';
    titleRule.style.fontFamily = localStorage.HEADER_FONT_FAMILY;
    const hfs = parseInt(localStorage.HEADER_FONT_SIZE || '0', 10) || 0;
    if(hfs) {
      titleRule.style.fontSize = (hfs / 10).toFixed(2) + 'em';
    }
  }
}

function styleUpdateContentRule(sheet) {
  const rule = styleFindCSSRule(sheet, 'div.entry span.entry-content');
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

  const blh = parseInt(localStorage.BODY_LINE_HEIGHT, 10) || 10;
  rule.style.lineHeight = (blh / 10).toFixed(2);
  let colCount = localStorage.COLUMN_COUNT;
  const validCountObject = { '1': true, '2': true, '3': true };
  if(!(colCount in validCountObject)) {
    colCount = '1';
  }
  rule.style.webkitColumnCount = colCount;
}

function styleOnChange(event) {
  const sheet = styleGetStylesheet();
  styleUpdateEntryRule(sheet);
  styleUpdateTitleRule(sheet);
  styleUpdateContentRule(sheet);
}

function styleGetStylesheet() {
  // Use the first sheet
  return document.styleSheets[0];
}

// Appends new style rules to the document's style sheet
function styleOnLoad() {
  const sheet = styleGetStylesheet();
  let buffer = [];

  if(localStorage.BACKGROUND_IMAGE) {
    buffer.push(`background: url(${localStorage.BACKGROUND_IMAGE});`);
  }

  else if(localStorage.ENTRY_BACKGROUND_COLOR) {
    buffer.push(`background: ${localStorage.ENTRY_BACKGROUND_COLOR};`);
  }

  buffer.push('margin:0px;');

  const entryMargin = localStorage.ENTRY_MARGIN;
  if(entryMargin) {
    buffer.push(`padding:${entryMargin}px;`);
  }

  sheet.addRule('div.entry', buffer.join(''));

  buffer = [];

  const hfs = parseInt(localStorage.HEADER_FONT_SIZE || '0', 10);
  if(hfs) {
    buffer.push(`font-size: ${(hfs / 10).toFixed(2)}em;`);
  }

  const headerFontFam = localStorage.HEADER_FONT_FAMILY;
  if(headerFontFam) {
    buffer.push(`font-family:${headerFontFam};`);
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

  buffer = [];

  const bfs = parseInt(localStorage.BODY_FONT_SIZE || '0', 10);
  if(bfs) {
    buffer.push(`font-size: ${(bfs / 10).toFixed(2)}em;`);
  }

  const bodyJustify = localStorage.JUSTIFY_TEXT === '1';
  if(bodyJustify) {
    buffer.push('text-align: justify;');
  }

  const bodyFont = localStorage.BODY_FONT_FAMILY;
  if(bodyFont) {
    buffer.push(`font-family:${bodyFont};`);
  }

  let blh = localStorage.BODY_LINE_HEIGHT;
  if(blh) {
    blh = parseInt(blh, 10);

    // TODO: units?
    if(blh) {
      buffer.push(`line-height: ${(blh / 10).toFixed(2)};`);
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
  const colCount = localStorage.COLUMN_COUNT;
  if(colCount === '2' || colCount === '3') {
    buffer.push(`-webkit-column-count: ${colCount};`);
    buffer.push('-webkit-column-gap:30px;');
    buffer.push('-webkit-column-rule:1px outset #AAAAAA;');
  }

  sheet.addRule('div.entry span.entry-content', buffer.join(''));
}
