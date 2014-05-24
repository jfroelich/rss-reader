
// Initialize the About section
function initAbout(event) {
  document.removeEventListener('DOMContentLoaded', initAbout);
    
  var manifest = chrome.runtime.getManifest();
  document.getElementById('extension-name').textContent = manifest.name || '?';
  document.getElementById('extension-version').textContent = manifest.version || '?';
  document.getElementById('extension-author').textContent = manifest.author || '?';
  document.getElementById('extension-description').textContent = manifest.description || '';
  document.getElementById('extension-homepage').textContent = manifest.homepage_url || '';
}

document.addEventListener('DOMContentLoaded', initAbout);