import {Model} from '/src/model/model.js';

// Refreshes the unread count displayed the badge in Chrome's toolbar
export async function badge_refresh() {
  const session = new Model();
  await session.open();
  const count = await session.countUnreadEntries();
  session.close();
  const text = count > 999 ? '1k+' : '' + count;
  set_badge_text({text: text});
}

export function set_badge_text(options) {
  return chrome.browserAction.setBadgeText(options);
}
