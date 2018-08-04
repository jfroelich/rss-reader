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
