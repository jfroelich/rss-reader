// Opens a tab. If the tab is already open, then this focuses on that tab. If reuseNewtab is true
// and the newtab is open in another tab, then this switches to that newtab tab and replaces it with
// the given url. Otherwise, this creates a new tab with the given url.
//
// This implementation is tightly coupled to chrome extension apis.
export default async function openTab(relativeURLString, reuseNewtab) {
  const urlString = chrome.extension.getURL(relativeURLString);
  const viewTab = await findTab(urlString);
  if (viewTab) {
    chrome.tabs.update(viewTab.id, { active: true });
    return;
  }

  if (reuseNewtab) {
    const newtab = await findTab('chrome://newtab/');
    if (newtab) {
      chrome.tabs.update(newtab.id, { active: true, url: urlString });
      return;
    }
  }

  // Try to minimize use of chrome api where possible.
  open(urlString, '_blank');
}

function findTab(urlString) {
  return new Promise((resolve) => {
    chrome.tabs.query({ url: urlString }, (tabs) => {
      resolve((tabs && tabs.length) ? tabs[0] : undefined);
    });
  });
}
