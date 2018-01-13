/**
 * This script tests whether Minimeteor can generate Docker images
 * for all existing Meteor release version.
 */

require('dotenv').config();

const Logger = require("./lib/logger.js");
const GitHub = require("./lib/github.js");
const DockerHub = require("./lib/dockerhub.js");
const Config = require("./lib/config.js");
const Util = require("./lib/util.js");

const BuildMeteorImage = require("./build-meteor-image.js");

/**
 * Fetches all Meteor release versions from GitHub
 * @returns {Promise<string[]>}
 */
async function fetchAllMeteorReleaseVersionsFromGithub() {
  let gitTags = await GitHub.getGithubTags("meteor", "meteor");
  let releaseTags = gitTags
    .filter(tag => tag.startsWith(Config.METEOR_RELEASE_TAG))
    .map(tag => tag.substring(Config.METEOR_RELEASE_TAG.length));
  return releaseTags;
}

async function main() {
  Logger.log("-------- MINIMETEOR TEST --------");

  try {
    // Fetch all Meteor release versions
    let gitHubMeteorReleases = await fetchAllMeteorReleaseVersionsFromGithub();

    // Fetch all Meteor Docker images
    let dockerHubMeteorImages =
      await DockerHub.getDockerHubTags(Config.DOCKER_OWNER, Config.DOCKER_METEOR_IMAGE);

    // Try to build one of them
    await BuildMeteorImage.tryBuildMeteorImage(gitHubMeteorReleases, dockerHubMeteorImages);
  }
  catch (ex) {
    Logger.error(ex);
  }

  Logger.debug("All done.");
  Util.cleanupDocker();
}

main().catch(err => Logger.error(err));
