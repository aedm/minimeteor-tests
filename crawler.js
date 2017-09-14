"use strict";

const Version = require("./lib/version.js");
const GitHub = require("./lib/github.js");
const DockerHub = require("./lib/dockerhub.js");
const Util = require("./lib/util.js");
const Config = require("./lib/config.js");
const Logger = require("./lib/logger.js");

function createBuildList(releaseTags, meteorDockerTags) {
  Logger.debug("Creating build list");
  for (let tag of releaseTags) {
    if (meteorDockerTags.find(x => x == tag)) continue;
    let version = Version.fromString(tag);
    if (!version || version.isSubversion || version.isLessThan([1,3])) continue;
    Util.enqueueMeteorTag(tag);
  }
}

function main() {
  let releaseTags = [];
  let meteorDockerTags = [];

  // Process GitHub tags
  GitHub.getGithubTags("meteor", "meteor")
  .then(tags => {
    for (let tag of tags) {
      if (tag.startsWith(Config.METEOR_RELEASE_TAG)) {
        releaseTags.push(tag.substring(Config.METEOR_RELEASE_TAG.length));
      }
    }
    Logger.debug(`${releaseTags.length} release tags found.`);
    return DockerHub.getDockerHubTags(Config.DOCKER_OWNER, Config.DOCKER_METEOR_IMAGE);
  })

  // Process aedm/meteor Docker tags
  .then(tags => {
    meteorDockerTags = tags;
    createBuildList(releaseTags, meteorDockerTags);
  });
}

main();


