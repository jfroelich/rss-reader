// TODO: embed custom attribute in the li tag itself
// and read from that, then deprecate map.


var navigation = {};

// Keep track of the currently displayed section 
// and selected menu item
navigation.currentSection;
navigation.currentMenuItem;

// Map between menu items and sections

navigation.menuMap = {
  'mi-feed-details':'section-feed-details',
  'mi-add-subscription':'section-add-subscription',
  'mi-discover-subscription':'divdiscover',
  'mi-display-settings':'section-display-settings',
  'mi-embeds':'section-embeds',
  'mi-content-filters':'section-content-filters',
  'mi-rewriting':'section-url-rewriting',
  'mi-import-export':'section-import-export',
  'mi-view-help':'divhelp',
  'mi-view-about':'divabout'
};

navigation.onClick = function(event) {
  navigation.showSection(event.target);
};

// Update the menu and show the desired section
navigation.showSection = function(menuItem) {
  
  if(!menuItem) {
    return;
  }

  // Ignore re-selection
  if(navigation.currentMenuItem == menuItem) {
    return;
  }

  menuItem.classList.add('navigation-item-selected');
  
  // Deselect only if set (as not set on page load)
  if(navigation.currentMenuItem) {
    navigation.currentMenuItem.classList.remove('navigation-item-selected');
  }
  
  // Hide the old section if present (as not set on page load)
  if(navigation.currentSection) {
    navigation.currentSection.style.display = 'none';
  }

  // Get the section corresponding to the menu item
  var section = document.getElementById(
    navigation.menuMap[menuItem.id]);

  // Show the new section
  section.style.display = 'block';

  // Update currently selected menu item and displayed section
  navigation.currentMenuItem = menuItem;
  navigation.currentSection = section;  
};

navigation.addOnClick = function(menuItem) {
  menuItem.onclick = navigation.onClick;
};

navigation.init = function() {
  document.removeEventListener('DOMContentLoaded', navigation.init);

  // Attach click handlers
  chrome.extension.getBackgroundPage().collections.each(
    document.querySelectorAll('li.navigation-item'), 
    navigation.addOnClick);

  // Show the default section
  navigation.showSection(document.getElementById('mi-add-subscription'));  
};

document.addEventListener('DOMContentLoaded', navigation.init);