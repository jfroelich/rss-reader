// Copyright 2014 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';
// TODO: proper attribution comments for all images and fonts

var BACKGROUND_IMAGES = [
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

var FONT_FAMILIES = [
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


function applyEntryStylesOnChange() {

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
  }

  var titleRule = findCSSRule(sheet,'div.entry a.entry-title');
  if(titleRule) {

    // Workaround chrome bug
    titleRule.style.background = '';

    titleRule.style.fontFamily = localStorage.HEADER_FONT_FAMILY;

    var hfs = parseInt(localStorage.HEADER_FONT_SIZE || '0', 10) || 0;
    console.debug('Setting header font size to %s', (hfs / 10).toFixed(2));
    titleRule.style.fontSize = (hfs / 10).toFixed(2) + 'em';
  }

  var contentRule = findCSSRule(sheet, 'div.entry span.entry-content');
  if(contentRule) {

    // Workaround chrome bug
    contentRule.style.background = '';

    contentRule.style.fontFamily = localStorage.BODY_FONT_FAMILY || 'initial';

    var bfs = parseInt(localStorage.BODY_FONT_SIZE || '0', 10) || 0;
    console.debug('Setting body font size to %s', (bfs / 10).toFixed(2));
    contentRule.style.fontSize = (bfs / 10).toFixed(2) + 'em';

    contentRule.style.textAlign = (localStorage.JUSTIFY_TEXT == '1') ? 'justify' : 'left';
    contentRule.style.lineHeight = localStorage.BODY_LINE_HEIGHT || 'normal';
  }
}

function applyEntryStylesOnLoad() {
  var sheet = document.styleSheets[0];

  var s = '';
  if(localStorage.BACKGROUND_IMAGE) {
    s += 'background: url('+ localStorage.BACKGROUND_IMAGE  +');';
  } else if(localStorage.ENTRY_BACKGROUND_COLOR) {
    s += 'background:'+ localStorage.ENTRY_BACKGROUND_COLOR+';';
  }

  s += 'margin-left: 0px;margin-right: 0px; margin-bottom: 0px; margin-top:0px;';
  s += 'padding-top: 12px;';
  s += 'padding-left:12px;';
  s += 'padding-right:12px;';
  //s += 'padding-bottom:160px;';
  s += 'padding-bottom:20px;';
  sheet.addRule('div.entry',s);

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
  s += 'padding-left: 150px;';
  s += 'padding-right: 150px;';
  s += 'padding-bottom: 10px;';


  sheet.addRule('div.entry a.entry-title', s);

  // BUG FIX: the change to bfs uses s += '' so the above
  // props were being applied to the body. now we properly
  // set s to empty.
  s = '';


  var bfs = parseInt(localStorage.BODY_FONT_SIZE || '0', 10) || 0;

  // console.debug('Setting body font size to %s em', (bfs / 10).toFixed(2));

  s += 'font-size:' + (bfs / 10).toFixed(2) + 'em;';

  s += 'text-align: '+ ((localStorage.JUSTIFY_TEXT == '1') ? 'justify' : 'left')+';';
  s += 'font-family:'+ (localStorage.BODY_FONT_FAMILY || '')  +';';
  s += 'line-height:'+(localStorage.BODY_LINE_HEIGHT || 'normal')+';';
  s += 'vertical-align: text-top;';
  //s += 'letter-spacing: -0.03em;';
  //s += 'word-spacing: -0.5em;';
  s += 'display:block;';
  s += 'word-wrap: break-word;';

  s += 'padding-top: 30px;';
  s += 'padding-right: 150px;';
  s += 'padding-left: 150px;';
  s += 'padding-bottom: 20px;';

  s += 'margin: 0px;';

  // TODO: use this if columns enabled (use 1(none), 2, 3 as options).
  // s += '-webkit-column-count: 2;';
  // s += '-webkit-column-gap: 30px;';
  // s += '-webkit-column-rule:1px outset #cccccc;';

  sheet.addRule('div.entry span.entry-content', s);
}


//Finds first matching CSS rule by selectorText query.
function findCSSRule(sheet, selectorText) {

  if(!sheet) {
    return;
  }

  var rules = sheet.cssRules;

  // TODO: use a partial instead of an outer scope ref

  var matches = Array.prototype.filter.call(rules, function(rule) {
    return rule.selectorText == selectorText;
  });

  // TODO: is the length check even necessary?
  if(matches.length) {
    return matches[0];
  }
}