// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

var rdr = rdr || {};

// Style lib

const DisplaySettings = {};

chrome.runtime.onMessage.addListener(function(message) {
  // Only react to the one message type of interest
  if(message.type === 'displaySettingsChanged') {
    DisplaySettings.updateStyles();
  }
});

// TODO: this is not yet in use, but the idea is to remove prefix
DisplaySettings.BACKGROUND_BASE_PATH = '/images/';

// TODO: remove some of these backgrounds, I kind of went overboard, some of
// these are useless
DisplaySettings.BACKGROUND_IMAGE_PATHS = [
  '/images/bgfons-paper_texture318.jpg',
  '/images/CCXXXXXXI_by_aqueous.jpg',
  '/images/paper-backgrounds-vintage-white.jpg',
  '/images/pickering-texturetastic-gray.png',
  '/images/reusage-recycled-paper-white-first.png',
  '/images/subtle-patterns-beige-paper.png',
  '/images/subtle-patterns-cream-paper.png',
  '/images/subtle-patterns-exclusive-paper.png',
  '/images/subtle-patterns-groove-paper.png',
  '/images/subtle-patterns-handmade-paper.png',
  '/images/subtle-patterns-paper-1.png',
  '/images/subtle-patterns-paper-2.png',
  '/images/subtle-patterns-paper.png',
  '/images/subtle-patterns-rice-paper-2.png',
  '/images/subtle-patterns-rice-paper-3.png',
  '/images/subtle-patterns-soft-wallpaper.png',
  '/images/subtle-patterns-white-wall.png',
  '/images/subtle-patterns-witewall-3.png',
  '/images/thomas-zucx-noise-lines.png'
];

// TODO: remove support for some of these fonts that are not very readable
DisplaySettings.FONT_FAMILIES = [
  'ArchivoNarrow-Regular',
  'Arial, sans-serif',
  'Calibri',
  'Calibri Light',
  'Cambria',
  'CartoGothicStd',
  //http://jaydorsey.com/free-traffic-font/
  //Clearly Different is released under the SIL Open Font License (OFL) 1.1.
  //Based on http://mutcd.fhwa.dot.gov/pdfs/clearviewspacingia5.pdf
  'Clearly Different',
  /* By John Stracke, Released under the OFL. Downloaded from his website */
  'Essays1743',
  // Downloaded free font from fontpalace.com, unknown author
  'FeltTip',
  'Georgia',
  'Montserrat',
  'MS Sans Serif',
  'News Cycle, sans-serif',
  'Noto Sans',
  'Open Sans Regular',
  'PathwayGothicOne',
  'PlayfairDisplaySC',
  'Raleway, sans-serif',
  // http://www.google.com/design/spec/resources/roboto-font.html
  'Roboto Regular'
];

DisplaySettings.findCSSRule = function(sheet, selectorText) {

  function ruleHasText(rule) {
    return rule.selectorText === selectorText;
  }

  return Array.prototype.find.call(sheet.cssRules, ruleHasText);
};

DisplaySettings.updateStyles = function() {

  // Assume a sheet is always available
  const sheet = document.styleSheets[0];

  const entryRule = DisplaySettings.findCSSRule(sheet, 'div.entry');
  if(entryRule) {
    if(localStorage.BACKGROUND_IMAGE) {
      entryRule.style.backgroundColor = '';
      entryRule.style.backgroundImage = 'url(' +
        localStorage.BACKGROUND_IMAGE + ')';
    } else if(localStorage.ENTRY_BACKGROUND_COLOR) {
      entryRule.style.backgroundColor = localStorage.ENTRY_BACKGROUND_COLOR;
      entryRule.style.backgroundImage = '';
    } else {
      entryRule.style.backgroundColor = '';
      entryRule.style.backgroundImage = '';
    }

    const entryMargin = localStorage.ENTRY_MARGIN || '10';
    entryRule.style.paddingLeft = entryMargin + 'px';
    entryRule.style.paddingRight = entryMargin + 'px';
  }

  const titleRule = DisplaySettings.findCSSRule(sheet,
    'div.entry a.entry-title');
  if(titleRule) {
    titleRule.style.background = '';
    titleRule.style.fontFamily = localStorage.HEADER_FONT_FAMILY;
    const hfs = parseInt(localStorage.HEADER_FONT_SIZE || '0', 10) || 0;
    if(hfs) {
      const hfsString = (hfs / 10).toFixed(2) + 'em';
      titleRule.style.fontSize = hfsString;
    }
  }

  const contentRule = DisplaySettings.findCSSRule(sheet,
    'div.entry span.entry-content');
  if(contentRule) {
    contentRule.style.background = '';
    contentRule.style.fontFamily = localStorage.BODY_FONT_FAMILY || 'initial';

    const bfs = parseInt(localStorage.BODY_FONT_SIZE || '0', 10);
    if(bfs) {
      contentRule.style.fontSize = (bfs / 10).toFixed(2) + 'em';
    }

    contentRule.style.textAlign = (localStorage.JUSTIFY_TEXT === '1') ?
      'justify' : 'left';

    const blh = parseInt(localStorage.BODY_LINE_HEIGHT, 10) || 10;
    contentRule.style.lineHeight = (blh / 10).toFixed(2);
    let colCount = localStorage.COLUMN_COUNT;
    const VALID_COUNTS = { '1': true, '2': true, '3': true };
    if(!(colCount in VALID_COUNTS)) {
      colCount = '1';
    }

    contentRule.style.webkitColumnCount = parseInt(colCount);
  }
};

// Dynamically creates new style rules and appends them to the first style
// sheet. This assumes the first style sheet exists.
DisplaySettings.loadStyles = function() {
  // Assume a sheet is always available
  const sheet = document.styleSheets[0];

  let buffer = [];

  if(localStorage.BACKGROUND_IMAGE) {
    buffer.push('background:url(');
    buffer.push(localStorage.BACKGROUND_IMAGE);
    buffer.push(');');
  } else if(localStorage.ENTRY_BACKGROUND_COLOR) {
    buffer.push('background:');
    buffer.push(localStorage.ENTRY_BACKGROUND_COLOR);
    buffer.push(';');
  }

  buffer.push('margin:0px;');

  const entryMargin = localStorage.ENTRY_MARGIN;
  if(entryMargin) {
    buffer.push('padding:');
    buffer.push(entryMargin);
    buffer.push('px;');
  }

  sheet.addRule('div.entry', buffer.join(''));

  // Reset the buffer.
  buffer = [];

  const hfs = parseInt(localStorage.HEADER_FONT_SIZE || '0', 10);
  if(hfs) {
    buffer.push('font-size:');
    buffer.push((hfs / 10).toFixed(2));
    buffer.push('em;');
  }

  const header_font_fam = localStorage.HEADER_FONT_FAMILY;
  if(header_font_fam) {
    buffer.push('font-family:');
    buffer.push(header_font_fam);
    buffer.push(';');
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

  // Reset the buffer
  buffer = [];


  const bfs = parseInt(localStorage.BODY_FONT_SIZE || '0', 10);
  if(bfs) {
    buffer.push('font-size:');
    buffer.push((bfs / 10).toFixed(2));
    buffer.push('em;');
  }

  const body_justify = localStorage.JUSTIFY_TEXT === '1';
  if(body_justify) {
    buffer.push('text-align: justify;');
  }

  const body_font = localStorage.BODY_FONT_FAMILY;
  if(body_font) {
    buffer.push('font-family:');
    buffer.push(body_font);
    buffer.push(';');
  }

  let blh = localStorage.BODY_LINE_HEIGHT;
  if(blh) {
    blh = parseInt(blh);
    if(blh) {
      // TODO: units?
      buffer.push('line-height:');
      buffer.push((blh / 10).toFixed(2));
      buffer.push(';');
    }
  }

  buffer.push('vertical-align:text-top;');
  //buffer.push('letter-spacing:-0.03em;');
  //buffer.push('word-spacing:-0.5em;');
  buffer.push('display:block;');
  buffer.push('word-wrap:break-word;');

  // buffer.push('white-space: normal;');
  // Actually this screws it up, now it is breaking everything instead of
  // wrapping, so only apply it to td
  // buffer.push('word-break: break-all;');

  buffer.push('padding-top:20px;');
  buffer.push('padding-right:0px;');
  buffer.push('padding-left:0px;');
  buffer.push('padding-bottom:20px;');
  buffer.push('margin:0px;');

  // TODO: use this if columns enabled (use 1(none), 2, 3 as options).
  const colCount = localStorage.COLUMN_COUNT;
  if(colCount === '2' || colCount === '3') {
    buffer.push('-webkit-column-count:');
    buffer.push(colCount);
    buffer.push(';');
    buffer.push('-webkit-column-gap:30px;');
    buffer.push('-webkit-column-rule:1px outset #AAAAAA;');
  }

  sheet.addRule('div.entry span.entry-content', buffer.join(''));

  // Reminder: if adding another rule, reset the buffer variable
};
