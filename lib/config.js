
module.exports = {
  // GitHub tag for Meteor releases
  METEOR_RELEASE_TAG: "release/METEOR@",

  // Dockher Hub repo owner
  DOCKER_OWNER: "aedm",

  // Meteor images repository
  DOCKER_METEOR_IMAGE: "meteor",
  DOCKER_ALPINE_IMAGE: "meteor-alpinebuild",
  DOCKER_BUILD_TEST_IMAGE: "minimeteor-buildtest",
  DOCKER_MINIMETEOR_IMAGE: "minimeteor",

  // Node.js command
  NODE_CMD: "node --harmony",

  METEORCRAWLER_DIR_ENV: "METEORCRAWLER_DIR",

  METEOR_BUILD_QUEUE_FILE: "meteor.queue",
  ALPINE_BUILD_QUEUE_FILE: "alpine.queue",
};