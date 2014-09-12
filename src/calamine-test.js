// Testing calamine


function testCalamine(url) {
  var each = Array.prototype.forEach;
  var r = new XMLHttpRequest();
  r.onload = onGet;
  r.open('GET', url, true);
  r.responseType='document';
  r.send();

  function onGet() {
    var doc = r.responseXML;
    var imgs = doc.body.getElementsByTagName('img');
    each.call(imgs, resolveImageSource.bind(this, r.responseURL));
    each.call(imgs, setImageDimensions);

    lucu.removeComments(doc);
    lucu.removeBlacklistedElements(doc);
    lucu.removeUnknownElements(doc);
    lucu.removeTracerImages(doc);
    lucu.canonicalizeSpaces(doc);
    lucu.trimNodes(doc);
    lucu.removeEmptyNodes(doc);
    lucu.removeEmptyElements(doc);

    var results = calamine.transformDocument(doc, {
      SHOW_CHAR_COUNT: 1,
      SHOW_SCORE: 1,
      IMAGE_BRANCH: 1
    });

    //lucu.removeDescendantAttributes(lucu.DEFAULT_ALLOWED_ATTRIBUTES , results);
    //lucu.removeDescendantAttributes(lucu.DEFAULT_ALLOWED_ATTRIBUTES , doc.body);
    lucu.trimElement(results);

    results.setAttribute('best', 'best');
    //document.body.appendChild(results);
    document.body.appendChild(doc.body);
    document.body.fontSize = '12pt';
  }

  function setImageDimensions(img) {
    if(!img.hasAttribute('src')) return;
    if(img.width) return;
    if(/^\s*data:/i.test(img.getAttribute('src'))) return;

    var local = document.importNode(img, false);
    local.onerror = console.debug;
    local.onload = function() {
      img.width = local.width;
      img.height = local.height;
    }

    var t = local.src;
    local.src = void t;
    local.src = t;// triggers fetch
  }

  function resolveImageSource(base, img) {
    var url = img.getAttribute('src');
    if(!url) return;
    if(/^\*sdata:/i.test(url)) return;
    var abs = URI(url).absoluteTo(base).toString();
    if(abs != url) {
      img.setAttribute('src', abs);
    }
  }
}