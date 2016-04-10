// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

// Style lib
// TODO: maybe use just one function for both load/change

function style_onmessage(message) {
  'use strict';

  if(!message) {
    console.debug('Undefined message');
    return;
  }

  if(message.type === 'displaySettingsChanged') {
    style_update_styles();
  }
}

chrome.runtime.onMessage.addListener(style_onmessage);

// todo: this is not yet in use, but the idea is to remove media prefix
const STYLE_BACKGROUND_BASE_PATH = '/images/';

const STYLE_BACKGROUND_IMAGES = [
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

const STYLE_FONT_FAMILIES = [
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

// TODO: elevate this into its own file
// Note: Array.prototype.find requires Chrome 45+
function style_find_css_rule(sheet, selectorText) {
  'use strict';
  return Array.prototype.find.call(sheet.cssRules, function equals(rule) {
    return rule.selectorText === selectorText;
  });
}

function style_update_styles() {
  'use strict';

  // Assume a sheet is always available
  const sheet = document.styleSheets[0];

  const entryRule = style_find_css_rule(sheet, 'div.entry');
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

  const titleRule = style_find_css_rule(sheet,'div.entry a.entry-title');
  if(titleRule) {
    titleRule.style.background = '';
    titleRule.style.fontFamily = localStorage.HEADER_FONT_FAMILY;
    const hfs = parseInt(localStorage.HEADER_FONT_SIZE || '0', 10) || 0;
    if(hfs) {
      const hfsString = (hfs / 10).toFixed(2) + 'em';
      titleRule.style.fontSize = hfsString;
    }
  }

  const contentRule = style_find_css_rule(sheet,
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

    const bodyLineHeight = parseInt(localStorage.BODY_LINE_HEIGHT, 10) || 10;
    contentRule.style.lineHeight = (bodyLineHeight / 10).toFixed(2);
    let columnCount = localStorage.COLUMN_COUNT;
    const VALID_COUNTS = { '1': true, '2': true, '3': true };
    if(!(columnCount in VALID_COUNTS)) {
      columnCount = '1';
    }

    contentRule.style.webkitColumnCount = parseInt(columnCount);
  }
}

// Dynamically creates new style rules and appends them to the first style
// sheet. This assumes the first style sheet exists.
function style_load_styles() {
  'use strict';

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

  const headerFontFamily = localStorage.HEADER_FONT_FAMILY;
  if(headerFontFamily) {
    buffer.push('font-family:');
    buffer.push(headerFontFamily);
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

  buffer = [];


  const bfs = parseInt(localStorage.BODY_FONT_SIZE || '0', 10);
  if(bfs) {
    buffer.push('font-size:');
    buffer.push((bfs / 10).toFixed(2));
    buffer.push('em;');
  }

  const bodyTextJustify = localStorage.JUSTIFY_TEXT === '1';
  if(bodyTextJustify) {
    buffer.push('text-align: justify;');
  }

  const bodyFontFamily = localStorage.BODY_FONT_FAMILY;
  if(bodyFontFamily) {
    buffer.push('font-family:');
    buffer.push(bodyFontFamily);
    buffer.push(';');
  }

  let bodyLineHeight = localStorage.BODY_LINE_HEIGHT;
  if(bodyLineHeight) {
    bodyLineHeight = parseInt(bodyLineHeight);
    if(bodyLineHeight) {
      // TODO: units?
      buffer.push('line-height:');
      buffer.push((bodyLineHeight / 10).toFixed(2));
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
  const columnCount = localStorage.COLUMN_COUNT;
  if(columnCount === '2' || columnCount === '3') {
    buffer.push('-webkit-column-count:');
    buffer.push(columnCount);
    buffer.push(';');
    buffer.push('-webkit-column-gap:30px;');
    buffer.push('-webkit-column-rule:1px outset #AAAAAA;');
  }

  sheet.addRule('div.entry span.entry-content', buffer.join(''));

  // Reminder: if adding another rule, reset the buffer variable
}
