// Open the slideshow view in a tab.
export default async function open_view(reuse_newtab) {
  const url_string = chrome.extension.getURL('slideshow.html');
  const view_tab = await find_tab(url_string);
  if (view_tab) {
    chrome.tabs.update(view_tab.id, {active: true});
    return;
  }

  if (reuse_newtab) {
    const newtab = await find_tab('chrome://newtab/');
    if (newtab) {
      chrome.tabs.update(newtab.id, {active: true, url: url_string});
      return;
    }
  }

  open(url_string, '_blank');
}

function find_tab(url_string) {
  return new Promise(resolve => {
    chrome.tabs.query({url: url_string}, tabs => {
      resolve((tabs && tabs.length) ? tabs[0] : undefined);
    });
  });
}
