// Copyright 2014 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

// TODO: think of a better name for this
// TODO: should it be lucu.ui.style?

var lucu = lucu || {};
lucu.style = {};

lucu.style.onChange = function() {

  // Assume a sheet is always available
  var sheet = document.styleSheets[0];

  var entryRule = lucu.css.findRule(sheet,'div.entry');
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

  var titleRule = lucu.css.findRule(sheet,'div.entry a.entry-title');
  if(titleRule) {

    // Workaround chrome bug
    titleRule.style.background = '';

    titleRule.style.fontFamily = localStorage.HEADER_FONT_FAMILY;

    var hfs = parseInt(localStorage.HEADER_FONT_SIZE || '0', 10) || 0;
    //console.debug('Setting header font size to %s', (hfs / 10).toFixed(2));
    titleRule.style.fontSize = (hfs / 10).toFixed(2) + 'em';
  }

  var contentRule = lucu.css.findRule(sheet, 'div.entry span.entry-content');
  if(contentRule) {

    // Workaround chrome bug
    contentRule.style.background = '';

    contentRule.style.fontFamily = localStorage.BODY_FONT_FAMILY || 'initial';

    var bfs = parseInt(localStorage.BODY_FONT_SIZE || '0', 10) || 0;
    //console.debug('Setting body font size to %s', (bfs / 10).toFixed(2));
    contentRule.style.fontSize = (bfs / 10).toFixed(2) + 'em';

    contentRule.style.textAlign = (localStorage.JUSTIFY_TEXT == '1') ? 'justify' : 'left';
    contentRule.style.lineHeight = localStorage.BODY_LINE_HEIGHT || 'normal';
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

  s += 'margin-left: 0px;margin-right: 0px; margin-bottom: 0px; margin-top:0px;';
  s += 'padding-top: 6px;';
  s += 'padding-bottom:20px;';

  var entryMargin = localStorage.ENTRY_MARGIN || '10';
  s += 'padding-left: '+entryMargin+'px;';
  s += 'padding-right: '+entryMargin+'px;';

  sheet.addRule('div.entry',s);

  // RESET s !!!!
  s = '';

  var hfs = parseInt(localStorage.HEADER_FONT_SIZE || '0', 10) || 0;
  s += 'font-size:' + (hfs / 10).toFixed(2) + 'em;';

  s += 'font-family:'+ (localStorage.HEADER_FONT_FAMILY || '')  +';';
  s += 'letter-spacing: -0.03em;';
  s += 'color: rgba(50, 50, 50, 0.9);';
  s += 'margin-bottom:12px;';
  s += 'margin-left:0px;';
  s += 'text-decoration:none;';
  s += 'display:block;';
  s += 'word-wrap: break-word;';
  s += 'text-shadow: 1px 1px 2px #cccccc;';
  s += 'text-transform: capitalize;';
  s += 'padding-top: 20px;';
  s += 'padding-left: 0px;';
  s += 'padding-right: 0px;';
  s += 'padding-bottom: 4px;';

  sheet.addRule('div.entry a.entry-title', s);

  // Reset s !!
  s = '';

  var bfs = parseInt(localStorage.BODY_FONT_SIZE || '0', 10) || 0;
  s += 'font-size:' + (bfs / 10).toFixed(2) + 'em;';

  var bodyTextJustify = localStorage.JUSTIFY_TEXT == '1';
  if(bodyTextJustify) {
    s += 'text-align: justify;';
  }


  var bodyFontFamily = localStorage.BODY_FONT_FAMILY;
  if(bodyFontFamily) {
    s += 'font-family:' + localStorage.BODY_FONT_FAMILY + ';';
  }

  var bodyLineHeight = localStorage.BODY_LINE_HEIGHT;
  if(bodyLineHeight) {
    // TODO: units?
    s += 'line-height:' + localStorage.BODY_LINE_HEIGHT + ';';
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
  // s += '-webkit-column-count: 2;';
  // s += '-webkit-column-gap: 30px;';
  // s += '-webkit-column-rule:1px outset #cccccc;';

  sheet.addRule('div.entry span.entry-content', s);
};
