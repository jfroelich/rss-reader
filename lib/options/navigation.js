
var navigation = {};

navigation.onClick = function(event) {
  navigation.showSection(event.target);
};

navigation.addOnClick = function(menuItem) {
  menuItem.onclick = navigation.onClick;
};

// Update the menu and show the desired section
navigation.showSection = function(menuItem) {
  if(!menuItem || navigation.currentMenuItem_ == menuItem)
    return;
  menuItem.classList.add('navigation-item-selected');
  if(navigation.currentMenuItem_)
    navigation.currentMenuItem_.classList.remove('navigation-item-selected'); 
  if(navigation.currentSection_)
    navigation.currentSection_.style.display = 'none';
  var section = document.getElementById(menuItem.getAttribute('section'));
  section.style.display = 'block';
  navigation.currentMenuItem_ = menuItem;
  navigation.currentSection_ = section;  
};

navigation.init = function() {
  document.removeEventListener('DOMContentLoaded', navigation.init);

  var navContentFilters = $('li#mi-content-filters');
  navContentFilters.style.display = localStorage.ENABLE_CONTENT_FILTERS ? 'block' : 'none';

  var navURLRewriting = $('li#mi-rewriting');
  navURLRewriting.style.display = localStorage.URL_REWRITING_ENABLED ? 'block' : 'none';

  var navApprovedEmbeds = $('li#mi-embeds');
  navApprovedEmbeds.style.display = localStorage.EMBED_POLICY == 'ask' ? 'block' : 'none';

  var each = chrome.extension.getBackgroundPage().collections.each;
  each($$('li.navigation-item'), navigation.addOnClick);
  navigation.showSection($('li#mi-add-subscription'));  
};

document.addEventListener('DOMContentLoaded', navigation.init);