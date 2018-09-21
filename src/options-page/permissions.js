// TODO: if this module is only in use in one place, this should not be a global
// module, this should just be a helper module located with that other module's
// own folder.
// TODO: think of a better name for this module so it is extremely clear

export function has(perm) {
  return new Promise(
      resolve => chrome.permissions.contains({permissions: [perm]}, resolve));
}

export function request(perm) {
  return new Promise(
      resolve => chrome.permissions.request({permissions: [perm]}, resolve));
}

export function remove(perm) {
  return new Promise(
      resolve => chrome.permissions.remove({permissions: [perm]}, resolve));
}
