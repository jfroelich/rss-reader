
# Research 406

Debug line printed as result of calling fetch_html: Response not ok
http://daringfireball.net/linked/2016/10/31/intel-mbp-ram 406 Not Acceptable.
This also occurred in line 345 in favicon.js.

This messages shows up in the console when visiting the page:

A Parser-blocking, cross-origin script, http://connect.decknetwork.net/deckDF_js.php?1477969301611, is invoked via document.write. This may be blocked by the browser if the device has poor network connectivity. See https://www.chromestatus.com/feature/5718547946799104
for more details. (anonymous) @ intel-mbp-ram:112

The site is using a file name mint.js, and mint.js has some funky document.write stuff.
This is on Chrome 55, which I believe just mentioned something about this happening.
I am on broadband.
