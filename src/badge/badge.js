import * as platform from '/src/platform/platform.js';
import {Model} from '/src/model/model.js';

// Refreshes the unread count displayed the badge in Chrome's toolbar
export async function badge_refresh() {
  const session = new Model();
  await session.open();
  const count = await session.countUnreadEntries();
  session.close();
  const text = count > 999 ? '1k+' : '' + count;
  platform.badge.set_text({text: text});
}
