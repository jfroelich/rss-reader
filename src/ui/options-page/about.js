export function About() {}

About.prototype.init = function(parent) {
  const heading = document.createElement('h1');
  heading.textContent = 'About';
  parent.appendChild(heading);

  const manifest = chrome.runtime.getManifest();

  let p = document.createElement('p');
  p.setAttribute('class', 'option-text');
  p.textContent = 'Name: ' + (manifest.name || '');
  parent.appendChild(p);

  p = document.createElement('p');
  p.setAttribute('class', 'option-text');
  p.textContent = 'Author: ' + (manifest.author || '');
  parent.appendChild(p);

  p = document.createElement('p');
  p.setAttribute('class', 'option-text');
  p.textContent = 'Description: ' + (manifest.description || '');
  parent.appendChild(p);

  p = document.createElement('p');
  p.setAttribute('class', 'option-text');
  p.textContent = 'Version: ' + (manifest.version || '');
  parent.appendChild(p);

  p = document.createElement('p');
  p.setAttribute('class', 'option-text');
  p.textContent = 'Homepage: ';
  if (manifest.homepage_url) {
    let anchor = document.createElement('a');
    anchor.setAttribute('target', '_blank');
    anchor.setAttribute('href', manifest.homepage_url);
    anchor.textContent = manifest.homepage_url;
    p.appendChild(anchor);
  } else {
    p.textContent += 'unknown';
  }

  parent.appendChild(p);

  p = document.createElement('p');
  p.setAttribute('class', 'option-text');
  p.textContent = 'See the LICENSE file on GitHub for license, eula, ' +
      'privacy policy, and attributions.';
  parent.appendChild(p);
};
