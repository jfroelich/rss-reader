
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

      // NOTE: for some unknown reason
      // /^\s*data\s*:/i does not match but the following does
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
      SHOW_CHAR_COUNT: true,
      SHOW_ANCHOR_CHAR_COUNT: true,
      SHOW_SCORE: true
    });

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

    var self = this;
    var local = document.importNode(img, false);

    local.onerror = function(e) {
      // console.debug('loading error %o', e);

      // An image loading error should not preclude
      // reaching onComplete
      if(++self.processed == self.count) {
        self.onComplete();
      }
    };

    local.onload = function() {
      img.width = local.width;
      img.height = local.height;
      if(++self.processed == self.count) {
        self.onComplete();
      }
    };

    // Trigger the load
    var t = local.src;
    local.src = void t;
    local.src = t;
  }

  return 'Running test';
}
