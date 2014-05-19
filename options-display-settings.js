// Must be loaded after fonts.js to access FONT_FAMILIES global

// Note:
// look into using document.styleSheets to propagate to view

function initBodyFontMenu() {
  var menu = document.getElementById('select_body_font');
  var preview = document.getElementById('body_font_preview');
  var currentFontFamily = localStorage.BODY_FONT_FAMILY;
  
  var fontOption = document.createElement('option');
  fontOption.textContent = 'Use Chrome font settings';
  menu.appendChild(fontOption);
  
  for(var key in FONT_FAMILIES) {
    fontOption = document.createElement('option');
    fontOption.value = key;
    if(key == currentFontFamily)
      fontOption.selected = true;
    fontOption.textContent = key;
    menu.appendChild(fontOption);
  }
  
  preview.className = FONT_FAMILIES[currentFontFamily] || '';
  menu.addEventListener('change', function(event) {
    var value = event.target.value;
    console.log('Changing body font family to %s', value || 'the default browser settings');

    // Update the preview
    preview.className = FONT_FAMILIES[value] || '';
    
    // Update the stored setting
    if(value) {
      localStorage.BODY_FONT_FAMILY = value;
    } else {
      delete localStorage.BODY_FONT_FAMILY;
    }

    // Notify other views of the change
    chrome.runtime.sendMessage({'type':'bodyFontChanged'});    
  });
}

function initHeaderFontMenu() {
  
  var menu = document.getElementById('select_header_font');
  var preview = document.getElementById('header_font_preview');
  var currentFontFamily = localStorage.HEADER_FONT_FAMILY;
  
  var fontOption = document.createElement('option');
  fontOption.textContent = 'Use Chrome font settings';
  menu.appendChild(fontOption);

  for(var key in FONT_FAMILIES) {
    fontOption = document.createElement('option');
    fontOption.setAttribute('value',key);
    if(key == currentFontFamily)
      fontOption.setAttribute('selected','');
    fontOption.textContent = key;
    menu.appendChild(fontOption);
  }

  preview.className = FONT_FAMILIES[currentFontFamily] || '';
  menu.addEventListener('change', function(event){
    // Get the new value
    var value = event.target.value;
    
    console.log('Changing header font family to %s', value || 'the default browser settings');

    // Update the preview
    preview.className = FONT_FAMILIES[value] || '';
    
    // Update the stored setting
    if(value) {
      localStorage.HEADER_FONT_FAMILY = value;
    } else {
      delete localStorage.HEADER_FONT_FAMILY;
    }

    // Notify other views of the change
    chrome.runtime.sendMessage({'type':'headerFontChanged'});
  });
}

function initDisplaySettings(event) {
  document.removeEventListener('DOMContentLoaded', initDisplaySettings);
    
   // Initialize the Display settings section
  initHeaderFontMenu();
  initBodyFontMenu();
}

document.addEventListener('DOMContentLoaded', initDisplaySettings);