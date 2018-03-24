export const ENTRY_STATE_UNREAD = 0;
export const ENTRY_STATE_READ = 1;
export const ENTRY_STATE_UNARCHIVED = 0;
export const ENTRY_STATE_ARCHIVED = 1;


// TODO: implement
export function entry_is_valid(entry) {
  if (!is_entry(entry)) {
    return false;
  }

  return true;
}
