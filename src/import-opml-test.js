// See license.md

// TODO: create a basic test
// 1. create a fake database,
// 2. create a fake opml.
// 3. import the opml file into the database
// 4. assert the database has the proper data
// 5. delete the database once finished

// TODO: Do a separate test that handles invalid opml
// TODO: Do a separate test that handles multiple files
// TODO: Do a separate test that handles

// In order to do the above I need to refactor several things
// I need to refactor subscribe so that it can be easily mocked so that the
// import can complete using a fake subscription process

// TODO: i need to refactor how the function 'prompts' for files. I don't want
// the test to prompt for files, I want to be able to just specify some fake
// files somehow. I don't have an immediately clear idea on how to accomplish
// this. Maybe a files parameter. If set it should be
// an array of file objects and import does not prompt. If not set, import
// will block and prompt.
// - there is a separate issue here, can i even create File objects?


function test() {
  const testDbTarget = {
    'name': 'test-opml-import',
    'version': 1
  };
}
