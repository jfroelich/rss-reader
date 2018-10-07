import * as ls from '/src/base/localstorage.js';

export async function open_view() {
  const url_string = chrome.extension.getURL('slideshow.html');

  let tab = await find_tab(url_string);
  if (tab) {
    chrome.tabs.update(tab.id, {active: true});
    return;
  }

  const reuse_newtab = ls.read_boolean('reuse_newtab');
  if (reuse_newtab) {
    tab = await find_tab('chrome://newtab/');
    if (tab) {
      chrome.tabs.update(tab.id, {active: true, url: url_string});
      return;
    }
  }

  chrome.tabs.create({active: true, url: url_string});
}

function find_tab(url_string) {
  return new Promise(resolve => {
    const query = {url: url_string};
    chrome.tabs.query(query, tabs => {
      if (tabs && tabs.length) {
        resolve(tabs[0]);
      }
      resolve();
    });
  });
}
