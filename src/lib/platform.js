export function add_install_listener(listener) {
  return chrome.runtime.onInstalled.addListener(listener);
}

export function add_startup_listener(listener) {
  return chrome.runtime.onStartup.addListener(listener);
}

export function add_alarm_listener(listener) {
  return chrome.alarms.onAlarm.addListener(listener);
}

export function clear_alarms(callback) {
  return chrome.alarms.clearAll(callback);
}

export function create_alarm(name, options) {
  return chrome.alarms.create(name, options);
}

export function get_alarms(callback) {
  return chrome.alarms.getAll(callback);
}

export function remove_alarm(name, callback) {
  return chrome.alarms.clear(name, callback);
}

export function get_extension_url_string(url_string) {
  return chrome.extension.getURL(url_string);
}

export function create_tab(options) {
  return chrome.tabs.create(options);
}

export function update_tab(id, options) {
  return chrome.tabs.update(id, options);
}

// Searches for an open tab with the given url
export function find_tab(url_string) {
  return new Promise(resolve => {
    const query = {url: url_string};
    chrome.tabs.query(query, tabs => {
      if (tabs && tabs.length) {
        resolve(tabs[0]);
      }
      resolve();
    });
  });
}

export function set_badge_text(options) {
  return chrome.browserAction.setBadgeText(options);
}

export function add_badge_click_listener(listener) {
  return chrome.browserAction.onClicked.addListener(listener);
}

export function query_idle_state(idle_secs) {
  return new Promise(resolve => chrome.idle.queryState(idle_secs, resolve));
}

export function has_permission(perm) {
  return new Promise(
      resolve => chrome.permissions.contains({permissions: [perm]}, resolve));
}

export function request_permission(perm) {
  return new Promise(
      resolve => chrome.permissions.request({permissions: [perm]}, resolve));
}

export function remove_permission(perm) {
  return new Promise(
      resolve => chrome.permissions.remove({permissions: [perm]}, resolve));
}
