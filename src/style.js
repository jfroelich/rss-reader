// Copyright 2014 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

var lucu = lucu || {};

// TODO: maybe use just one function for both load/change, figure that out

lucu.style = {};

lucu.style.onMessage = function(message) {
  if(message && message.type === 'displaySettingsChanged') {
    lucu.style.onChange();
  }
};

chrome.runtime.onMessage.addListener(lucu.style.onMessage);

// todo: add style ns, remove media prefix as it is DRY
// use BACKGROUND_PATH_BASE
lucu.style.BACKGROUND_PATH_BASE = '/media/';

lucu.BACKGROUND_IMAGES = [
  '/media/bgfons-paper_texture318.jpg',
  '/media/CCXXXXXXI_by_aqueous.jpg',
  '/media/paper-backgrounds-vintage-white.jpg',
  '/media/pickering-texturetastic-gray.png',
  '/media/reusage-recycled-paper-white-first.png',
  '/media/subtle-patterns-beige-paper.png',
  '/media/subtle-patterns-cream-paper.png',
  '/media/subtle-patterns-exclusive-paper.png',
  '/media/subtle-patterns-groove-paper.png',
  '/media/subtle-patterns-handmade-paper.png',
  '/media/subtle-patterns-paper-1.png',
  '/media/subtle-patterns-paper-2.png',
  '/media/subtle-patterns-paper.png',
  '/media/subtle-patterns-rice-paper-2.png',
  '/media/subtle-patterns-rice-paper-3.png',
  '/media/subtle-patterns-soft-wallpaper.png',
  '/media/subtle-patterns-white-wall.png',
  '/media/subtle-patterns-witewall-3.png',
  '/media/thomas-zucx-noise-lines.png'
];

lucu.FONT_FAMILIES = [
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


lucu.style.findCSSRule = function(sheet, selectorText) {
  var filter = Array.prototype.filter;
  // TODO: use Array.prototype.find? or reduce?
  // if we want just the first rule then this is dumb
  var rules = sheet ? sheet.cssRules : [];
  var matches = filter.call(rules, 
    lucu.style.findCSSRuleFilter.bind(null, selectorText));

  if(matches.length) {
    return matches[0];
  }
};

lucu.style.findCSSRuleFilter = function(text, rule) {
  return rule.selectorText = text;
};


lucu.style.onChange = function() {
  'use strict';

  console.debug('lucu.style.onChange called');

  var filter = Array.prototype.filter;

  var findCSSRule = lucu.style.findCSSRule;

  // Assume a sheet is always available
  var sheet = document.styleSheets[0];

  var entryRule = findCSSRule(sheet,'div.entry');
  if(entryRule) {
    if(localStorage.BACKGROUND_IMAGE) {
      entryRule.style.backgroundColor = '';
      entryRule.style.backgroundImage = 'url(' + localStorage.BACKGROUND_IMAGE + ')';
    } else if(localStorage.ENTRY_BACKGROUND_COLOR) {
      entryRule.style.backgroundColor = localStorage.ENTRY_BACKGROUND_COLOR;
      entryRule.style.backgroundImage = '';
    } else {
      entryRule.style.backgroundColor = '';
      entryRule.style.backgroundImage = '';
    }

    var entryMargin = localStorage.ENTRY_MARGIN || '10';
    // console.log('Setting padding left right to %spx', entryMargin);
    entryRule.style.paddingLeft = entryMargin + 'px';
    entryRule.style.paddingRight = entryMargin + 'px';
  }

  // New bug, changing any style does not update styles 
  // in real time as expected. For some reason this used to work
  // but now does not work. If the page is refreshed the style
  // is correct.

  var titleRule = findCSSRule(sheet,'div.entry a.entry-title');
  if(titleRule) {

    console.log('Found title rule');

    // Workaround chrome bug
    titleRule.style.background = '';

    titleRule.style.fontFamily = localStorage.HEADER_FONT_FAMILY;

    var hfs = parseInt(localStorage.HEADER_FONT_SIZE || '0', 10) || 0;
    console.debug('hfs after change is %s', hfs);

    if(hfs) {
      var hfsString = (hfs / 10).toFixed(2) + 'em';
      console.debug('Setting header font size to %s', hfsString);
      titleRule.style.fontSize = hfsString;
      console.debug('Header font size is now %s', titleRule.style.fontSize);
    } else {
      console.warn('header font size after change not set or 0');
    }
  } else {
    console.log('Title rule not found');
  }

  var contentRule = findCSSRule(sheet, 'div.entry span.entry-content');
  if(contentRule) {

    // Workaround chrome bug
    contentRule.style.background = '';

    contentRule.style.fontFamily = localStorage.BODY_FONT_FAMILY || 'initial';

    var bfs = parseInt(localStorage.BODY_FONT_SIZE || '0', 10) || 0;
    //console.debug('Setting body font size to %s', (bfs / 10).toFixed(2));
    if(bfs) {
      contentRule.style.fontSize = (bfs / 10).toFixed(2) + 'em';
    } else {
      console.warn('onchange body font size not set or 0');
    }

    contentRule.style.textAlign = (localStorage.JUSTIFY_TEXT == '1') ? 'justify' : 'left';

    var bodyLineHeight = parseInt(localStorage.BODY_LINE_HEIGHT) || 10;
    contentRule.style.lineHeight = (bodyLineHeight / 10).toFixed(2);

    // column count
    //COLUMN_COUNT

    var columnCount = localStorage.COLUMN_COUNT;
    var VALID_COUNTS = { '1': true, '2': true, '3': true };
    if(!(columnCount in VALID_COUNTS)) {
      columnCount = '1';
    }

    contentRule.style.webkitColumnCount = parseInt(columnCount);
  }
};



lucu.style.onLoad = function() {
  var sheet = document.styleSheets[0];

  var s = '';
  if(localStorage.BACKGROUND_IMAGE) {
    s += 'background: url('+ localStorage.BACKGROUND_IMAGE  +');';
  } else if(localStorage.ENTRY_BACKGROUND_COLOR) {
    s += 'background:'+ localStorage.ENTRY_BACKGROUND_COLOR+';';
  }

  s += 'margin: 0px;';

  var entryMargin = localStorage.ENTRY_MARGIN;
  if(entryMargin) {
    s += 'padding: ' + entryMargin + 'px;';
  } else {
    console.warn('onload ENTRY_MARGIN not set');
  }

  //console.debug('onLoad div.entry CSS %s', s);

  sheet.addRule('div.entry',s);

  // RESET s !!
  s = '';

  var hfs = parseInt(localStorage.HEADER_FONT_SIZE || '0', 10) || 0;

  if(hfs) {
    s += 'font-size:' + (hfs / 10).toFixed(2) + 'em;';
  } else {
    console.warn('header font size on load not set or 0');
  }

  s += 'font-family:'+ (localStorage.HEADER_FONT_FAMILY || '')  +';';
  s += 'letter-spacing: -0.03em;';
  s += 'color: rgba(50, 50, 50, 0.9);';
  s += 'text-decoration:none;';
  s += 'display:block;';
  s += 'word-wrap: break-word;';
  s += 'text-shadow: 1px 1px 2px #cccccc;';
  s += 'text-transform: capitalize;';
  s += 'margin: 0px';
  s += 'padding: 0px';

  sheet.addRule('div.entry a.entry-title', s);

  // Reset s !!
  s = '';

  var bfs = parseInt(localStorage.BODY_FONT_SIZE || '0', 10) || 0;
  if(bfs) {
    s += 'font-size:' + (bfs / 10).toFixed(2) + 'em;';
  } else {
    // This should fix the fresh install bug
    console.warn('onload body font size not set or 0');
  }

  var bodyTextJustify = localStorage.JUSTIFY_TEXT == '1';
  if(bodyTextJustify) {
    s += 'text-align: justify;';
  }

  var bodyFontFamily = localStorage.BODY_FONT_FAMILY;
  if(bodyFontFamily) {
    s += 'font-family:' + bodyFontFamily + ';';
  }

  var bodyLineHeight = localStorage.BODY_LINE_HEIGHT;
  if(bodyLineHeight) {
    bodyLineHeight = parseInt(bodyLineHeight);
    if(bodyLineHeight) {
      // TODO: units?
      s += 'line-height:' + (bodyLineHeight / 10).toFixed(2) + ';';
    } else {

    }
  }

  s += 'vertical-align: text-top;';
  //s += 'letter-spacing: -0.03em;';
  //s += 'word-spacing: -0.5em;';
  s += 'display:block;';

  // BUG: https://news.ycombinator.com/item?id=8123152
  // Rendering this page it looks like very long strings were not broken
  // so right margin was not present and due to overflow-x:none a bunch
  // of content just disappeared off the right side. Need to force wrap.
  // I forget exactly how I did that, look at the 'pre' style rule?

  s += 'word-wrap: break-word;';

  s += 'padding-top: 20px;';
  s += 'padding-right: 0px;';
  s += 'padding-left: 0px;';
  s += 'padding-bottom: 20px;';

  s += 'margin: 0px;';

  // TODO: use this if columns enabled (use 1(none), 2, 3 as options).
  var columnCount = localStorage.COLUMN_COUNT;
  if(columnCount == '2' || columnCount == '3') {
    s += '-webkit-column-count: ' + columnCount + ';';
    s += '-webkit-column-gap: 30px;';
    s += '-webkit-column-rule: 1px outset #AAAAAA;';
  }

  sheet.addRule('div.entry span.entry-content', s);
};
