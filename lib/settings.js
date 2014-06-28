
'use strict';

var settings = {};

settings.BACKGROUND_IMAGES = [
  //http://www.desktopwallpapers4.me/abstract/leather-texture-21220/
  '/media/abstract-leather-texture.jpg',

  '/media/bgfons-paper_texture318.jpg',
  '/media/bone-yellow-1.jpg',
  '/media/CCXXXXXXI_by_aqueous.jpg',
  '/media/designova-subtle-carbon.png',
  '/media/dominik-kiss-grid.png',
  '/media/krisp-designs-vertical-cloth.png',
  '/media/paper-backgrounds-vintage-white.jpg',
  '/media/papertank-black-padded-diamond.png',
  '/media/pickering-texturetastic-gray.png',
  '/media/reusage-recycled-paper-white-first.png',
  '/media/recycled_paper_texture.jpg',

  //http://seamless-pixels.blogspot.com/p/free-seamless-ground-textures.html
  '/media/slodive-canvas-texture-paper.jpg',
  '/media/subtle-patterns-beige-paper.png',
  '/media/subtle-patterns-black-paper.png',
  '/media/subtle-patterns-brickwall.png',
  '/media/subtle-patterns-cream-paper.png',
  '/media/subtle-patterns-exclusive-paper.png',
  '/media/subtle-patterns-extra-clean-paper.png',
  '/media/subtle-patterns-groove-paper.png',
  '/media/subtle-patterns-handmade-paper.png',
  '/media/subtle-patterns-noisy-net.png',
  '/media/subtle-patterns-paper-1.png',
  '/media/subtle-patterns-paper-2.png',
  '/media/subtle-patterns-paper.png',
  '/media/subtle-patterns-rice-paper-2.png',
  '/media/subtle-patterns-rice-paper-3.png',
  '/media/subtle-patterns-sand-paper.png',
  '/media/subtle-patterns-soft-wallpaper.png',
  '/media/subtle-patterns-white-wall.png',
  '/media/subtle-patterns-witewall-3.png',
  '/media/tabor-classy-fabric.png',
  '/media/texturemate-4097.jpg',
  '/media/thomas-zucx-noise-lines.png',

  // http://background-pictures.vidzshare.net
  '/media/towel-white-free-background.jpg'
];

settings.FONT_FAMILIES = [
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

  'MS Sans Serif',
  'News Cycle, sans-serif',
  'Open Sans Regular',

  'PathwayGothicOne',

  'PlayfairDisplaySC',

  'Raleway, sans-serif'
];


settings.applyEntryStylesOnChange = function() {
  // Find the existing rules and modify them in place
  var sheet = document.styleSheets[0];
  //console.log('applying styles');

  var entryRule = util.findCSSRule(sheet,'div.entry');
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

  var titleRule = util.findCSSRule(sheet,'div.entry a.entry-title');
  if(titleRule) {
    titleRule.style.fontFamily = localStorage.HEADER_FONT_FAMILY;
    titleRule.style.fontSize = localStorage.HEADER_FONT_SIZE;
  }

  var contentRule = util.findCSSRule(sheet, 'div.entry span.entry-content');
  if(contentRule) {
    contentRule.style.fontFamily = localStorage.BODY_FONT_FAMILY || 'initial';
    contentRule.style.fontSize = localStorage.BODY_FONT_SIZE || '100%';
    contentRule.style.textAlign = (localStorage.JUSTIFY_TEXT == '1') ? 'justify' : 'left';
    contentRule.style.lineHeight = localStorage.BODY_LINE_HEIGHT || 'normal';
  }
};

settings.applyEntryStylesOnLoad = function() {
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

  s =  'font-size:'+ (localStorage.HEADER_FONT_SIZE || '') +';';
  s += 'font-family:'+ (localStorage.HEADER_FONT_FAMILY || '')  +';';
  s += 'letter-spacing: -0.03em;';
  s += 'color: rgba(50, 50, 50, 0.9);';
  s += 'padding: 0px 0px 0px 0px;';
  s += 'margin-bottom:12px;';
  s += 'margin-left:0px;';
  s += 'text-decoration:none;';
  s += 'display:block;';
  s += 'word-wrap: break-word;';
  s += 'text-shadow: 1px 1px 2px #cccccc;';
  s += 'text-transform: capitalize;';
  //s += 'text-align:justify;';
  sheet.addRule('div.entry a.entry-title', s);

  s =  'font-size: '+ (localStorage.BODY_FONT_SIZE || '')+';';
  s += 'text-align: '+ ((localStorage.JUSTIFY_TEXT == '1') ? 'justify' : 'left')+';';
  s += 'font-family:'+ (localStorage.BODY_FONT_FAMILY || '')  +';';
  s += 'line-height:'+(localStorage.BODY_LINE_HEIGHT || 'normal')+';';
  s += 'vertical-align:text-top;';
  //s += 'letter-spacing: -0.03em;';
  //s += 'word-spacing: -0.5em;';
  s += 'display:block;';
  s += 'word-wrap: break-word;';
  s += 'padding-top:0px;';
  s += 'padding-right: 10px;';
  s += 'margin: 0px;';

  // TODO: use this if columns enabled (use 1(none), 2, 3 as options).
  s += '-webkit-column-count: 2;';
  s += '-webkit-column-gap: 30px;';
  s += '-webkit-column-rule:1px outset #cccccc;';

  sheet.addRule('div.entry span.entry-content', s);
};