// A restricted operation is any type of operation that requires the use of a special permission,
// whether that is a browser-enabled permission, or some kind of app-layer permission. Basically
// any type of operation involving restricted access. This is kind of like an AccessDeniedError,
// if such a thing existed, but I've chosen to call it PermissionsError for now.

export class PermissionsError extends Error {
  constructor(message) {
    super(message || 'Not permitted');
  }
}
