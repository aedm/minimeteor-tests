/**
 * Configuration holder
 */

const Logger = require("./logger.js");

const Config = {
  // GitHub tag for Meteor releases
  METEOR_RELEASE_TAG: "release/METEOR@",

  // Docker Hub repo owner
  DOCKER_HUB_USER: null,

  // GitHub API key
  GITHUB_OAUTH_TOKEN: null,

  // Email address to send notifications to
  EMAIL_ADDRESS: null,

  // Meteor images repository
  DOCKER_METEOR_IMAGE: "meteor",
  DOCKER_ALPINE_IMAGE: "meteor-alpinebuild",
  DOCKER_BUILD_TEST_IMAGE: "minimeteor-buildtest",
  DOCKER_MINIMETEOR_IMAGE: "minimeteor",

  // Node.js command
  NODE_CMD: "node --harmony",
};

(function initModule(){
  let hasError = false;

  function readEnvVariable(name) {
    if (!process.env.hasOwnProperty(name)) {
      Logger.error(`Environment variable "${name}" not found.`);
      hasError = true;
      return;
    }
    Config[name] = process.env[name];
  }

  readEnvVariable("DOCKER_HUB_USER");
  readEnvVariable("GITHUB_OAUTH_TOKEN");
  readEnvVariable("EMAIL_ADDRESS");

  if (hasError) {
    process.exit(1);
  }
})();

module.exports = Config;
