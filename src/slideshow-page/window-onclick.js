import {options_menu_hide} from '/src/slideshow-page/options-menu.js';

// This module's purpose is to handle clicks outside of the left panel. The
// left panel should close by clicking anywhere else. So we listen for clicks
// anywhere, check if the click was outside of the left panel, and if so, then
// hide the left panel. Ignored clicks are left as is, and passed along
// untouched to any other listeners. Clicks on the main menu are ignored because
// that is considered a part of the menu structure. Clicks on the left panel are
// ignored because that should not cause the left panel to hide.

// Note that this attaches the click listener on module load.


// TODO: it's possible that this should be hidden within the options-menu
// module, as one of its implicit features. Because this only pertains to that
// feature, and only that feature is concerned about it. By having it in its own
// module here, and importing this module exclusively into the main page, I am
// not using as tight of coupling as I would like. I think the anxiety stems
// from the fact that this listens to window events, and window is global. But
// it is better to perceive this differently. After all, we are simply attaching
// a listener with a particular purpose. We are not affecting whatever else
// listens to window (e.g. by setting window.onclick). It is perfectly normal to
// have a module have its own special listener encapsulated within itself
// despite that it is listening to a global object.

// Furthermore there are some structural clues. I am referencing the element id
// by name. And I am importing a helper function from the module. Once imported,
// I could refer to some constant internal to the module to get the element
// name. And, I would no longer need to have an export-import link (coupling)
// between two modules. And, this depends on nothing else. Those are all 3 good
// reasons why this belongs encapsulated within the options-menu module.



// TODO: independent of the todo related to hiding this functionality within
// the options-menu module, is that this should probably be somehow using
// functionality from options-menu, which is the left-panel module that is
// referred to in the function body. The incoherency is partially because this
// originally was all grouped up in a single module, slideshow-page.js, that was
// then split up into tinier modules, where it now becomes apparent that things
// could be better organized.

// TODO: review why this uses marginLeft. I thought I switched to left. There
// was some struggle getting the desired UI effects working initially.

const avoided_zone_ids = ['main-menu-button', 'left-panel'];

function window_onclick(event) {
  if (!avoided_zone_ids.includes(event.target.id) &&
      !event.target.closest('[id="left-panel"]')) {
    const left_panel_element = document.getElementById('left-panel');

    if (left_panel_element.style.marginLeft === '0px') {
      options_menu_hide();
    }
  }

  return true;
}

// TODO: is there some way to avoid explicitly using window? Is addEventListener
// a global while within module scope?

window.addEventListener('click', window_onclick);
