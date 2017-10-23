'use strict';

// TODO: fold into extension.js?

function permissions_contains(permission) {
  console.assert(typeof permission === 'string');
  return new Promise(function executor(resolve, reject) {
    const descriptor = {'permissions': [permission]};
    chrome.permissions.contains(descriptor, resolve);
  });
}

function permissions_request(permission) {
  console.assert(typeof permission === 'string');
  return new Promise(function executor(resolve, reject) {
    const descriptor = {'permissions': [permission]};
    chrome.permissions.request(descriptor, resolve);
  });
}

function permissions_remove(permission) {
  console.assert(typeof permission === 'string');
  return new Promise(function executor(resolve, reject) {
    const descriptor = {'permissions': [permission]};
    chrome.permissions.remove(descriptor, resolve);
  });
}
