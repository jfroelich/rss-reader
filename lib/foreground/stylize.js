// Shared by view and options, applies style changes

var FONT_FAMILIES = [
'Arial, sans-serif',
'Calibri',
'Calibri Light',
'Cambria',
'Georgia',
'MS Sans Serif',
'News Cycle, sans-serif',
'Open Sans Regular',
'Raleway, sans-serif'
];

function findCSSRule(selectorText) {
  var matchingRule;
  
  // We are always using styleSheets[0], so we can cheat here
  var sheet = document.styleSheets[0];
  app.until(sheet.rules, function(rule) {
    if(rule.selectorText == selectorText) {
      matchingRule = rule;
      return false;
    }
    return true;
  });
  return matchingRule;
}

function applyEntryStylesOnchange(event) {
  if(event.type != 'displaySettingsChanged') {
      return;
  }

  // Find the existing rules and modify them in place

  var entryRule = findCSSRule('div.entry');
  if(entryRule) {
    entryRule.style.backgroundColor = localStorage.ENTRY_BACKGROUND_COLOR;
  } else {
    console.warn('could not locate css rule div.entry');
  }
  
  var titleRule = findCSSRule('div.entry a.entry-title');
  if(titleRule) {
    titleRule.style.fontFamily = localStorage.HEADER_FONT_FAMILY;
    titleRule.style.fontSize = localStorage.HEADER_FONT_SIZE;
  } else {
    console.warn('could not locate css rule div.entry a.entry-title');
  }
  var contentRule = findCSSRule('div.entry span.entry-content');
  if(contentRule) {
    contentRule.style.fontFamily = localStorage.BODY_FONT_FAMILY || 'initial';
    contentRule.style.fontSize = localStorage.BODY_FONT_SIZE || '100%';
    contentRule.style.textAlign = (localStorage.JUSTIFY_TEXT == '1') ? 'justify' : 'left';  
    contentRule.style.lineHeight = localStorage.BODY_LINE_HEIGHT || 'normal';
  } else {
    console.warn('could not locate css rule div.entry span.entry-content');
  }
}

function applyEntryStylesOnload() {
  document.removeEventListener('DOMContentLoaded', applyEntryStylesOnload);
  
  // Add div.entry
  var s = 'background-color:'+ (localStorage.ENTRY_BACKGROUND_COLOR || '')+';';
  s += 'border-bottom: 1px dotted #cccccc;';
  s += 'margin: 0px;';
  s += 'padding: 12px;';
  //geometricPrecision|optimizeLegibility|auto|optimizeSpeed
  s += 'text-rendering: optimizeLegibility;';
  
  document.styleSheets[0].addRule('div.entry',s);

  // Add div.entry a
  s = 'text-decoration:none;';
  s += 'margin-left: 1px;';
  s += 'margin-right: 3px;';
  document.styleSheets[0].addRule('div.entry a', s);

  // Add div.entry img
  document.styleSheets[0].addRule('div.entry img', 'border:0px;max-width:100%;');

  // Add div.entry a.entryTitle
  s = 'font-size:'+ (localStorage.HEADER_FONT_SIZE || '') +';';
  s += 'letter-spacing: -0.06em;';
  s += 'color: rgb(90, 90, 111);';
  s += 'padding: 0px 0px 0px 0px;';
  s += 'margin-bottom:1px;';
  s += 'margin-left:0px;';
  s += 'text-decoration:none;';
  s += 'display:block;';
  s += 'word-wrap: break-word;';

  s += 'font-family:'+ (localStorage.HEADER_FONT_FAMILY || '')  +';';
  document.styleSheets[0].addRule('div.entry a.entry-title', s);
  
  // entry content
  s = 'font-size: '+ (localStorage.BODY_FONT_SIZE || '')+';';
  s += 'display:block;';
  s += 'word-wrap: break-word;';
  s += 'text-align: '+ ((localStorage.JUSTIFY_TEXT == '1') ? 'justify' : 'left')+';';
  s += 'font-family:'+ (localStorage.BODY_FONT_FAMILY || '')  +';';
  s += 'line-height:'+(localStorage.BODY_LINE_HEIGHT || 'normal')+';';
  document.styleSheets[0].addRule('div.entry span.entry-content', s);
}

// Bindings
chrome.runtime.onMessage.addListener(applyEntryStylesOnchange);
document.addEventListener('DOMContentLoaded', applyEntryStylesOnload);