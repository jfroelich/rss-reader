import TestRegistry from '/src/test/test-registry.js';
import assert from '/src/lib/assert.js';
import backgroundImageFilter from '/src/lib/dom-filters/css-background-image-filter.js';

function backgroundImageFilterTest() {
  // Create a simple dom, then run the filter on it

  const document = createDocument('Background image filter test');

  const url = 'https://www.example.com/example.gif';
  const containerWithBackgroundImage = document.createElement('div');
  containerWithBackgroundImage.style.backgroundImage = `url("${url}")`;
  document.body.append(containerWithBackgroundImage);

  backgroundImageFilter(document);

  const image = document.querySelector(`img[src="${url}"]`);
  assert(image);
}

function backgroundImageFilterWinterIsComingTest() {
  const document = createDocument('Background image filter test');
  document.body.innerHTML = `<div class="featured-image"
    score="45" boilerplate="high"><div
    style="background-image: url(typical-url-here);"
    class="img attachment-post-thumbnail wp-post-image article-image fs-ll"
    score="95" boilerplate="lowest">
    <a href="link-to-image-url"></a></div>
    </div>`;

  backgroundImageFilter(document);
}

function createDocument(title) {
  return document.implementation.createHTMLDocument(title);
}

TestRegistry.registerTest(backgroundImageFilterTest);
TestRegistry.registerTest(backgroundImageFilterWinterIsComingTest);
