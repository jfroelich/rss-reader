import {Model} from '/src/model/model.js';
import count_unread_entries from '/src/model/ops/count-unread-entries.js';

// Refreshes the unread count displayed the badge in Chrome's toolbar
export async function badge_refresh() {
  const model = new Model();
  await model.open();
  const count = await count_unread_entries(model);
  model.close();
  const text = count > 999 ? '1k+' : '' + count;
  set_badge_text({text: text});
}

export function set_badge_text(options) {
  return chrome.browserAction.setBadgeText(options);
}
