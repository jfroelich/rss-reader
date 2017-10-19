'use strict';

// Dependencies:
// assert.js
// debug.js
// image.js
// url.js

/*

# TODO

* would it be better to use a querySelectorAll that looks for images without
certain attributes, instead of filtering in memory?
* Provide options to allow caller to easily change which attributes are used
instead of using a hardcoded list.
* If an image has a srcset, then try and use that instead.
* If an image is within a picture, look for associated source

# Strange cases to look into and possibly handle better
* &lt;img class="responsive-image" srcset="url"&gt;  in this case i should be
able to try and infer from srcset?
* &lt;img data-src="url" src=""&gt; - note empty source
* &lt;img style="background-image:url(url);" src="url"&gt;
* &lt;img class="responsive-image" srcset="url"&gt;
* &gt;img class="lazyload" src="data:..." data-src="url"&gt;
* &lt;img data-path="url"&gt;
* &lt;img data-flickity-lazyload="url"&gt;
* &lt;img class=​"media__image media__image--responsive"
data-src-mini=​"url" data-src-xsmall=​"url" data-src-small=​"url"
data-src-medium=​"url" data-src-large=​"url" data-src-full16x9=​"url"
data-src-mini1x1=​"url" src=​"data-url"&gt;​
* &lt;img data-baseurl="url"  srcset="url 350w, url 400w"
sizes="(min-width: 1260px) 750px, (min-width: 1060px)
calc(100vw - 559px), (min-width: 840px) calc(100vw - 419px),
(min-width: 800px) 800px, 100.1vw"&gt;


# TODO: Images using a data url object placeholder and a normal image in alt
attr

&lt;img data-lazy-img="https://...jpg" src="data:..."&gt;

*/

const LAZY_IMAGE_FILTER_DEBUG = false;

function lazy_image_filter(doc) {
  ASSERT(doc);

  const lazy_img_attrs = [
    'load-src',
    'data-src',
    'data-original-desktop',
    'data-baseurl',
    'data-lazy',
    'data-img-src',
    'data-original',
    'data-adaptive-img',
    'data-imgsrc',
    'data-default-src'
  ];

  let num_imgs_modified = 0;
  const images = doc.getElementsByTagName('img');
  for(const img of images) {
    if(image_has_source(img))
      continue;

    for(const lazy_src_attr_name of lazy_img_attrs) {
      if(img.hasAttribute(lazy_src_attr_name)) {
        const url_string = img.getAttribute(lazy_src_attr_name);
        if(url_is_valid(url_string)) {
          img.removeAttribute(lazy_src_attr_name);
          img.setAttribute('src', url_string);

          if(LAZY_IMAGE_FILTER_DEBUG) {
            DEBUG('transformed lazily loaded image', img);
          }

          num_imgs_modified++;
          break;
        }
      }
    }
  }

  return num_imgs_modified;
}
