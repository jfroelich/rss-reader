// TODO: i should rename this file to just show-notification.js. It is a single
// function. I do not see the benefit of being more abstract. In fact I should
// maybe even rename it to show-desktop-notification.js or something that really
// emphasizes what it does, and distinguishes it from something like an html
// element that pops up in some view.

// TODO: i am placing this in the control layer for now. however, i think this
// somehow belongs in the base layer, but in the app-specific part, so that it
// is located beneath the database/model layer, so that the model layer can also
// consider using notification functionality. or maybe it is located in the
// right place. need to think about it more.

// TODO: separate to the issue with config, is that this relies on config.
// if i want to move this to a lower layer, that cannot happen. it is the
// single check at the start of the function that causes the early exit that
// ruins the ability to make this lower level. Well, a second issue is that
// the default icon should be coming from configuration, and that also should
// be read from config like the show_notifications setting, instead of being
// hardcoded here.

// TODO: test if the onclick opening of window is still needed to workaround Chrome
// 66 error when window is closed
