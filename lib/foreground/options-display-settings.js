
function initBodyFontMenu() {
  var menu = document.getElementById('select_body_font');
  var currentFontFamily = localStorage.BODY_FONT_FAMILY;
  var fontOption = document.createElement('option');
  fontOption.textContent = 'Use Chrome font settings';
  menu.appendChild(fontOption);
  
  FONT_FAMILIES.forEach(function(fontFamily) {
    fontOption = document.createElement('option');
    fontOption.value = fontFamily;
    fontOption.selected = fontFamily == currentFontFamily;
    fontOption.textContent = fontFamily;
    menu.appendChild(fontOption);
  });
  
  menu.addEventListener('change', function(event) {
    if(event.target.value) {
      localStorage.BODY_FONT_FAMILY = event.target.value;
    } else {
      delete localStorage.BODY_FONT_FAMILY;
    }

    chrome.runtime.sendMessage({'type':'displaySettingsChanged'});
  });
}

function initHeaderFontMenu() {
  var menu = document.getElementById('select_header_font');
  var currentFontFamily = localStorage.HEADER_FONT_FAMILY;
  var fontOption = document.createElement('option');
  fontOption.textContent = 'Use Chrome font settings';
  menu.appendChild(fontOption);

  FONT_FAMILIES.forEach(function(fontFamily) {
    fontOption = document.createElement('option');
    fontOption.value = fontFamily;
    fontOption.selected = fontFamily == currentFontFamily;
    fontOption.textContent = fontFamily;
    menu.appendChild(fontOption);
  });

  menu.addEventListener('change', function(event){
    if(event.target.value) {
      localStorage.HEADER_FONT_FAMILY = event.target.value;
    } else {
      delete localStorage.HEADER_FONT_FAMILY;
    }

    chrome.runtime.sendMessage({'type':'displaySettingsChanged'});
  });
}

function initDisplaySettings(event) {
  document.removeEventListener('DOMContentLoaded', initDisplaySettings);
    
   // Initialize the Display settings section
  initHeaderFontMenu();
  initBodyFontMenu();
  
  var inputChangedTimer;
  var inputChangedDelay = 400;
  
  var entryBgcolor = document.getElementById('entry-background-color');
  entryBgcolor.value = localStorage.ENTRY_BACKGROUND_COLOR || '';
  entryBgcolor.addEventListener('input', function(event) {
    clearTimeout(inputChangedTimer);
    inputChangedTimer = setTimeout(function(){
      if(event.target.value) {
        localStorage.ENTRY_BACKGROUND_COLOR = event.target.value;
      } else {
        delete localStorage.ENTRY_BACKGROUND_COLOR;
      }

      chrome.runtime.sendMessage({'type':'displaySettingsChanged'});      
    }, inputChangedDelay);
  });
  
  var headerFontSize = document.getElementById('header-font-size');
  headerFontSize.value = localStorage.HEADER_FONT_SIZE || '';
  headerFontSize.addEventListener('input', function(event) {
    clearTimeout(inputChangedTimer);
    inputChangedTimer = setTimeout(function() {
      if(event.target.value) {
        localStorage.HEADER_FONT_SIZE = event.target.value;
      } else {
        delete localStorage.HEADER_FONT_SIZE;
      }
      chrome.runtime.sendMessage({'type':'displaySettingsChanged'}); 
    }, inputChangedDelay);
  });
  
  var bodyFontSize = document.getElementById('body-font-size');
  bodyFontSize.value = localStorage.BODY_FONT_SIZE || '';
  bodyFontSize.addEventListener('input', function(event) {
    clearTimeout(inputChangedTimer);
    inputChangedTimer = setTimeout(function() {
      if(event.target.value) {
        localStorage.BODY_FONT_SIZE = event.target.value;
      } else {
        delete localStorage.BODY_FONT_SIZE;
      }
      chrome.runtime.sendMessage({'type':'displaySettingsChanged'}); 
    }, inputChangedDelay);
  });
  
  var justifyText = document.getElementById('justify-text');
  justifyText.checked = (localStorage.JUSTIFY_TEXT == '1') ? true : false;
  justifyText.addEventListener('change', function(event) {
    if(event.target.checked) {
      localStorage.JUSTIFY_TEXT = '1';
    } else {
      delete localStorage.JUSTIFY_TEXT;
    }
    chrome.runtime.sendMessage({'type':'displaySettingsChanged'}); 
  });
  
  var bodyLineHeight = document.getElementById('body-line-height');
  bodyLineHeight.value = localStorage.BODY_LINE_HEIGHT || '';
  bodyLineHeight.addEventListener('input', function(event) {
    clearTimeout(inputChangedTimer);
    inputChangedTimer = setTimeout(function() {
      if(event.target.value) {
        localStorage.BODY_LINE_HEIGHT = event.target.value;
      } else {
        delete localStorage.BODY_LINE_HEIGHT;
      }
      chrome.runtime.sendMessage({'type':'displaySettingsChanged'}); 
    }, inputChangedDelay);
  });
}

document.addEventListener('DOMContentLoaded', initDisplaySettings);