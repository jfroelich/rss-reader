import * as platform from '/src/platform.js';
import * as tls from '/src/typed-localstorage.js';

// TODO: if this module only exports one function it should be named after that
// one function because that way the name better communicates the simplicity of
// the module (the lack of complexity).

// Open the slideshow view in a tab.
export async function open_view() {
  // Check if the view is already open and switch to it
  const url_string = platform.extension.get_url_string('slideshow.html');
  const view_tab = await platform.tab.find(url_string);
  if (view_tab) {
    platform.tab.update(view_tab.id, {active: true});
    return;
  }

  // Otherwise, try and reuse the newtab tab
  const reuse_newtab = tls.read_boolean('reuse_newtab');
  if (reuse_newtab) {
    const newtab = await platform.tab.find('chrome://newtab/');
    if (newtab) {
      platform.tab.update(newtab.id, {active: true, url: url_string});
      return;
    }
  }

  // Otherwise, open the view in a new tab
  platform.tab.create({active: true, url: url_string});
}
