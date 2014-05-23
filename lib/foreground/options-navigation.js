
var app = chrome.extension.getBackgroundPage();

// Keep track of the currently displayed section 
// and selected menu item
var currentSection, currentMenuItem;

// Map between menu items and sections
// TODO: embed custom attribute in the li tag itself
// and read from that, then deprecate this map.
var menuItemIdToSectionIdMap = {
  'mi-add-subscription':'section-add-subscription',
  'mi-discover-subscription':'divdiscover',
  'mi-view-subscriptions':'divfeedlist',
  'mi-display-settings':'section-display-settings',
  'mi-embeds':'section-embeds',
  'mi-content-filters':'section-content-filters',
  'mi-import-export':'section-import-export',
  'mi-view-help':'divhelp',
  'mi-view-about':'divabout'
};

// Menu click handler
function navigationClick(event) {
  showSection(event.target);
}

// Update the menu and show the desired section
function showSection(menuItem) {
  
  // console.log('Called showSection with menuItem %s', menuItem);
  // console.log('typeof menuItem is %s', typeof menuItem);
  
  if(!menuItem) {
    return;
  }

  // Ignore re-selection
  if(currentMenuItem == menuItem) {
    return;
  }

  menuItem.classList.add('navigation-item-selected');
  
  // Deselect only if set (as not set on page load)
  if(currentMenuItem) {
    currentMenuItem.classList.remove('navigation-item-selected');
  }
  
  // Hide the old section if present (as not set on page load)
  if(currentSection) {
    currentSection.style.display = 'none';
  }

  // Get the section corresponding to the menu item
  var section = document.getElementById(
    menuItemIdToSectionIdMap[menuItem.id]);

  // Show the new section
  section.style.display = 'block';

  // Update currently selected menu item and displayed section
  currentMenuItem = menuItem;
  currentSection = section;
}

function initNavigation() {
  document.removeEventListener('DOMContentLoaded', initNavigation);

  // Initialize the navigation menu
  app.collections.each(document.querySelectorAll('li.navigation-item'), function(item) {
    item.onclick = navigationClick;
  });

  // Select the default navigation item and show the default section
  showSection(document.getElementById('mi-view-subscriptions'));
}

document.addEventListener('DOMContentLoaded', initNavigation);