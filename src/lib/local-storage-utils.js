// TODO: get rid of the hacks, libraries are not supposed to be app specific

export function rename(oldName, newName) {
  const value = readString(oldName);
  if (typeof value !== 'undefined') {
    writeString(newName, value);
  }
  remove(oldName);
}

export function hasKey(key) {
  return typeof localStorage[key] !== 'undefined';
}

export function readBoolean(key) {
  return typeof localStorage[key] !== 'undefined';
}

export function writeBoolean(key, value) {
  if (value) {
    localStorage[key] = '1';
  } else {
    delete localStorage[key];
  }
}

export function readInt(key) {
  const stringValue = localStorage[key];
  if (stringValue) {
    const integerValue = parseInt(stringValue, 10);
    if (!isNaN(integerValue)) {
      return integerValue;
    }
  }

  return NaN;
}

export function writeInt(key, value) {
  localStorage[key] = `${value}`;
}

export function readFloat(key) {
  return parseFloat(localStorage[key], 10);
}

export function writeFloat(key, value) {
  localStorage[key] = `${value}`;
}

export function readString(key) {
  return localStorage[key];
}

export function writeString(key, value) {
  localStorage[key] = value;
}

export function readArray(key) {
  // TODO: eventually think of how to persist in localStorage and remove this hack
  if (key === 'inaccessible_content_descriptors') {
    const descriptors = [
      { pattern: /forbes\.com$/i, reason: 'interstitial-advert' },
      { pattern: /productforums\.google\.com$/i, reason: 'script-generated' },
      { pattern: /groups\.google\.com$/i, reason: 'script-generated' },
      { pattern: /nytimes\.com$/i, reason: 'paywall' },
      { pattern: /wsj\.com$/i, reason: 'paywall' }
    ];

    return descriptors;
  }

  // TODO: eventually think of how to persist in localStorage and remove this hack
  if (key === 'rewrite_rules') {
    const rules = [];

    rules.push((url) => {
      if (url.hostname === 'news.google.com' && url.pathname === '/news/url') {
        const param = url.searchParams.get('url');
        try {
          return new URL(param);
        } catch (error) {
          // ignore
        }
      }

      return undefined;
    });

    rules.push((url) => {
      if (url.hostname === 'techcrunch.com' && url.searchParams.has('ncid')) {
        const output = new URL(url.href);
        output.searchParams.delete('ncid');
        return output;
      }

      return undefined;
    });

    rules.push((url) => {
      if (url.hostname === 'l.facebook.com' && url.pathname === '/l.php') {
        const param = url.searchParams.get('u');
        try {
          return new URL(param);
        } catch (error) {
          // ignore
        }
      }

      return undefined;
    });

    return rules;
  }

  const value = localStorage[key];
  return value ? JSON.parse(value) : [];
}

export function writeArray(key, value) {
  localStorage[key] = JSON.stringify(value);
}

export function remove(key) {
  delete localStorage[key];
}

export function removeAll(keys) {
  for (const key of keys) {
    delete localStorage[key];
  }
}
