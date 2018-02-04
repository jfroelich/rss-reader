
export function permission_has(permission) {
  return new Promise(
      resolve =>
          chrome.permissions.contains({permissions: [permission]}, resolve));
}

export function permission_request(permission) {
  return new Promise(
      resolve =>
          chrome.permissions.request({permissions: [permission]}, resolve));
}

export function permission_remove(permission) {
  return new Promise(
      resolve =>
          chrome.permissions.remove({permissions: [permission]}, resolve));
}
