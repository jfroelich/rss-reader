export function query_state(idle_secs) {
  return new Promise((resolve, reject) => {
    if (chrome && chrome.idle && chrome.idle.queryState) {
      chrome.idle.queryState(idle_secs, resolve);
    } else {
      reject(new Error('chrome.idle unavailable'));
    }
  });
}
