
Notification service. Provides the ability to show a desktop notification.

The function dynamically checks if notifications are supported.

There is also an app setting to enable or disable notifications.

# TODO: Test if still a need to open window before handling notification click
The notification click handler needs to check if the Chrome window is currently open before trying to show a tab, otherwise Chrome crashes. This was present in Chrome 55 on Mac. I want to test if this behavior is no longer needed.
