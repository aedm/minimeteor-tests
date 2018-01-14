"use strict";

require('dotenv').config();

const Version = require("./lib/version.js");
const GitHub = require("./lib/github.js");
const DockerHub = require("./lib/dockerhub.js");
const Util = require("./lib/util.js");
const Config = require("./lib/config.js");
const Logger = require("./lib/logger.js");

function createBuildList(releaseTags, meteorDockerTags) {
  Logger.debug("Creating build list");
  for (let tag of releaseTags) {
    if (meteorDockerTags.find(x => x === tag)) continue;
    let version = Version.fromString(tag);
    if (!version || version.isSubversion || version.isLessThan([1,3])) continue;
    Util.enqueueMeteorTag(tag);
  }
}

async function main() {
  // Process GitHub tags
  let gitTags = await GitHub.getGithubTags("meteor", "meteor");

  let releaseTags = gitTags
    .filter(tag => tag.startsWith(Config.METEOR_RELEASE_TAG))
    .map(tag => tag.substring(Config.METEOR_RELEASE_TAG.length));

  Logger.debug(`${releaseTags.length} release tags found.`);
  let dockerTags = await DockerHub.getDockerHubTagNames(Config.DOCKER_OWNER, Config.DOCKER_METEOR_IMAGE);

  // Process aedm/meteor Docker tags
  createBuildList(releaseTags, dockerTags);
}

main().catch(err => Logger.error(err));


