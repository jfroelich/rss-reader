
document.addEventListener('DOMContentLoaded', function ondcl() {
  document.removeEventListener('DOMContentLoaded', ondcl);
  document.documentElement.style.fontSize = '12pt';
  document.body.style.fontSize = '12pt';
});

// Testing calamine
function testCalamine(url) {
  var each = Array.prototype.forEach;
  var r = new XMLHttpRequest();
  r.onload = function () {
    var doc = r.responseXML;

    if(!doc.body) {
      console.warn('no body');
      return;
    }

    var imgs = doc.body.getElementsByTagName('img');
    if(!imgs.length) {
      return onImageDimensionsSet(doc);
    }

    each.call(imgs, function (img) {
      var url = img.getAttribute('src');
      if(!url) return;
      if(/^data:/i.test(url)) return;

      try {
        var abs = URI(url).absoluteTo(r.responseURL).toString();
        if(abs == url) return;
        img.setAttribute('src', abs);
      } catch(e) {
        console.debug(url);
      }
    });

    each.call(imgs, setImageDimensions.bind({
      count: imgs.length,
      processed: 0,
      onComplete: onImageDimensionsSet.bind(null, doc)
    }));
  };
  r.open('GET', url, true);
  r.responseType='document';
  r.send();

  function onImageDimensionsSet(doc) {

    lucu.removeComments(doc);
    lucu.removeBlacklistedElements(doc);
    lucu.removeTracerImages(doc);
    lucu.unwrapNoscripts(doc);
    lucu.unwrapNoframes(doc);
    lucu.canonicalizeSpaces(doc);
    lucu.trimNodes(doc);
    lucu.removeEmptyNodes(doc);
    lucu.removeEmptyElements(doc);
    var results = calamine.transform(doc, {
      EXPOSE_ATTRIBUTES: true,
      SHOW_CHAR_COUNT: true,
      SHOW_ANCHOR_CHAR_COUNT: true,
      SHOW_SCORE: true
    });

    // lucu.removeDescendantAttributes(lucu.DEFAULT_ALLOWED_ATTRIBUTES , doc.body);

    lucu.trimElement(results);
    results.setAttribute('best', 'best');
    results.style.border = '2px solid green';
    while(document.body.firstChild) {
      document.body.removeChild(document.body.firstChild);
    }
    document.body.appendChild(doc.body);
  }

  function setImageDimensions(img) {
    if(!img.getAttribute('src') || img.width) {
      if(++this.processed == this.count) {
        this.onComplete();
      }
      return;
    }

    var local = document.importNode(img, false);
    local.onerror = console.debug;
    var self = this;
    local.onload = function() {
      img.width = local.width;
      img.height = local.height;
      if(++self.processed == self.count) {
        self.onComplete();
      }
    };

    var t = local.src;
    local.src = void t;
    local.src = t;
  }
}
