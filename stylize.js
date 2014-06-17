// Shared by view and options, applies style changes

// TODO: consider caching the lookups to findCSSRule
// by storing the results in globals and then checking globals
// instead of checking every time. Perf seems fine at the moment 
// though.
// TODO: use a namespace

var stylize = {};

stylize.BACKGROUND_IMAGES = [
  //http://www.desktopwallpapers4.me/abstract/leather-texture-21220/
  'abstract-leather-texture.jpg',

  'bgfons-paper_texture318.jpg',
  'bling-whitepaper.jpg',
  'bone-1600-x-1200.png',
  'bone-yellow-1.jpg',
  'CCXXXXXXI_by_aqueous.jpg',
  'designova-subtle-carbon.png',
  'deviant-art-powerpuff.jpg',
  'dominik-kiss-grid.png',

  //http://galleryhip.com/cloth-texture.html
  'green-cloth-texture.jpg',
  'krisp-designs-vertical-cloth.png',
  'OTF_Crumpled_Paper_09.jpg',
  'OTF_Light_Grunge_14.jpg',
  'OTF_Snow_11.jpg',
  'OTF_Towel_07.jpg',
  'paper-background-cardboard.jpg',
  'paper-backgrounds-natural.jpg',
  'paper-backgrounds-vintage-white.jpg',
  'papertank-black-padded-diamond.png',
  'pig-quill-oatmeal-linen-paper-texture.jpeg',
  'pickering-texturetastic-gray.png',
  'ppd-white-paper-texture.jpg',
  'reusage-recycled-paper-white-first.png',
  'recycled_paper_texture.jpg',

  //http://seamless-pixels.blogspot.com/p/free-seamless-ground-textures.html
  'seamless-beach-sand.jpg',
  'slodive-canvas-texture-paper.jpg',
  'subtle-patterns-beige-paper.png',
  'subtle-patterns-black-paper.png',
  'subtle-patterns-brickwall.png',
  'subtle-patterns-cardboard.png',
  'subtle-patterns-cream-paper.png',
  'subtle-patterns-exclusive-paper.png',
  'subtle-patterns-extra-clean-paper.png',
  'subtle-patterns-groove-paper.png',
  'subtle-patterns-handmade-paper.png',
  'subtle-patterns-noisy-net.png',
  'subtle-patterns-paper-1.png',
  'subtle-patterns-paper-2.png',
  'subtle-patterns-paper.png',
  'subtle-patterns-rice-paper-2.png',
  'subtle-patterns-rice-paper-3.png',
  'subtle-patterns-sand-paper.png',
  'subtle-patterns-soft-wallpaper.png',
  'subtle-patterns-white-wall.png',
  'subtle-patterns-witewall-3.png',
  'tabor-classy-fabric.png',
  'texturemate-4097.jpg',
  'texture-palance-vintage-paper.jpg',
  'thomas-zucx-noise-lines.png',

  // http://background-pictures.vidzshare.net
  'towel-white-free-background.jpg',

  'yvrelle_towel_beige.jpg',
  'yvrelle_towel_beige.jpg'
];

stylize.FONT_FAMILIES = [
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

stylize.findCSSRule = function(selectorText) {
  var matchingRule;
  
  // We are always using styleSheets[0], so we can cheat here
  var sheet = document.styleSheets[0];
  util.until(sheet.rules, function(rule) {
    if(rule.selectorText == selectorText) {
      matchingRule = rule;
      return false;
    }
    return true;
  });
  return matchingRule;
};

stylize.applyEntryStylesOnchange = function() {
  // Find the existing rules and modify them in place

  //console.log('applying styles');

  var entryRule = stylize.findCSSRule('div.entry');
  if(entryRule) {
    //console.log('found div.entry');
    if(localStorage.BACKGROUND_IMAGE) {
      //console.log('setting background image to %s', localStorage.BACKGROUND_IMAGE);
      entryRule.style.backgroundColor = '';
      entryRule.style.backgroundImage = 'url(' + localStorage.BACKGROUND_IMAGE + ')';
    } else if(localStorage.ENTRY_BACKGROUND_COLOR) {
      entryRule.style.backgroundColor = localStorage.ENTRY_BACKGROUND_COLOR;
      entryRule.style.backgroundImage = '';
    } else {
      entryRule.style.backgroundColor = '';
      entryRule.style.backgroundImage = '';
    }
  } else {
    console.log('did not find div.entry');
  }

  var titleRule = stylize.findCSSRule('div.entry a.entry-title');
  if(titleRule) {
    titleRule.style.fontFamily = localStorage.HEADER_FONT_FAMILY;
    titleRule.style.fontSize = localStorage.HEADER_FONT_SIZE;
  }

  var contentRule = stylize.findCSSRule('div.entry span.entry-content');
  if(contentRule) {
    contentRule.style.fontFamily = localStorage.BODY_FONT_FAMILY || 'initial';
    contentRule.style.fontSize = localStorage.BODY_FONT_SIZE || '100%';
    contentRule.style.textAlign = (localStorage.JUSTIFY_TEXT == '1') ? 'justify' : 'left';  
    contentRule.style.lineHeight = localStorage.BODY_LINE_HEIGHT || 'normal';
  }
};

stylize.applyEntryStylesOnload = function() {
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