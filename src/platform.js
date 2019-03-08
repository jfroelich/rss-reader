// TODO: deprecate this module. there are a couple problems with it. first, it
// is a misrepresentation because it does not encapsulate all platform specific
// behavior, only platform api behavior. platforms can differ in behavior in
// many places, such as the behavior of any built-in javascript object or global
// function. the second problem is the cohesion, none of these functions make
// use of each other. this is a perfect example of mistakenly using logical
// cohesion over functional cohesion.

export const lifecycle = {};

lifecycle.add_install_listener = function(listener) {
  return chrome.runtime.onInstalled.addListener(listener);
};

lifecycle.add_startup_listener = function(listener) {
  return chrome.runtime.onStartup.addListener(listener);
};

export const alarm = {};

alarm.add_listener = function(listener) {
  return chrome.alarms.onAlarm.addListener(listener);
};

alarm.clear = function() {
  return new Promise(resolve => chrome.alarms.clearAll(resolve));
};

alarm.create = function(name, options) {
  return chrome.alarms.create(name, options);
};

alarm.get_all = function() {
  return new Promise(resolve => chrome.alarms.getAll(resolve));
};

alarm.remove = function(name, callback) {
  return new Promise(resolve => {
    chrome.alarms.clear(name, function(cleared) {
      resolve({name: name, cleared: cleared});
    });
  });
};

export const extension = {};

extension.get_manifest = function() {
  return chrome.runtime.getManifest();
};

extension.get_url_string = function(url_string) {
  return chrome.extension.getURL(url_string);
};

export const tab = {};

tab.create = function(options) {
  return chrome.tabs.create(options);
};

tab.update = function(id, options) {
  return chrome.tabs.update(id, options);
};

tab.find = function(url_string) {
  return new Promise(resolve => {
    chrome.tabs.query({url: url_string}, tabs => {
      resolve((tabs && tabs.length) ? tabs[0] : undefined);
    });
  });
};

export const badge = {};

badge.set_text = function(options) {
  return chrome.browserAction.setBadgeText(options);
};

badge.add_listener = function(listener) {
  return chrome.browserAction.onClicked.addListener(listener);
};

export const idle = {};

idle.query = function(seconds) {
  return new Promise(resolve => chrome.idle.queryState(seconds, resolve));
};

export const permission = {};

permission.has = function(name) {
  return new Promise(
      resolve => chrome.permissions.contains({permissions: [name]}, resolve));
};

permission.request = function(name) {
  return new Promise(
      resolve => chrome.permissions.request({permissions: [name]}, resolve));
};

permission.remove = function(name) {
  return new Promise(
      resolve => chrome.permissions.remove({permissions: [name]}, resolve));
};
