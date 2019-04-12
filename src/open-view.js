// Open the slideshow view in a tab.
export default async function openView(reuseNewtab) {
  const urlString = chrome.extension.getURL('slideshow.html');
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

  open(urlString, '_blank');
}

function findTab(urlString) {
  return new Promise((resolve) => {
    chrome.tabs.query({ url: urlString }, (tabs) => {
      resolve((tabs && tabs.length) ? tabs[0] : undefined);
    });
  });
}
