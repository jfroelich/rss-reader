# html
HTML utility functions. These functions generally accept an html string as input and do something to or with that input string.

### Security issue with html_decode_entities
This function currently sets element.innerHTML, where element is a detached element that is owned by the same document as the document that included the html.js module. This is extremely unsafe.

### html_decode_entities notes and todos
* why innerText? probably should just use textContent? Wait until I implement a testing lib to change.
* do not use the dom for entity encoding. I'd eventually like to not involve the dom but for now just get something working