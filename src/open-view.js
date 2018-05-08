export async function open_view() {
  const slideshow_url_string = chrome.extension.getURL('slideshow.html');
  const new_tab_url_string = 'chrome://newtab/';

  const slideshow_tabs = await find_tabs(slideshow_url_string);
  if (slideshow_tabs && slideshow_tabs.length) {
    chrome.tabs.update(slideshow_tabs[0].id, {active: true});
    return;
  }

  const new_tabs = await find_tabs(new_tab_url_string);
  if (new_tabs && new_tabs.length) {
    chrome.tabs.update(
        new_tabs[0].id, {active: true, url: slideshow_url_string});
    return;
  }

  chrome.tabs.create({url: slideshow_url_string});
}

function find_tabs(url_string) {
  return new Promise(resolve => chrome.tabs.query({url: url_string}, resolve));
}
