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
const TestMinimeteorDocker = require("./test-minimeteor-docker.js");

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
  Logger.debug("Starting:", process.argv.join(" "));

  try {
    // Fetch all Meteor release versions
    let gitHubMeteorReleases = await fetchAllMeteorReleaseVersionsFromGithub();

    // Fetch all Meteor Docker images
    let dockerHubMeteorImages = await DockerHub.getDockerHubTagNames(Config.DOCKER_METEOR_IMAGE);

    // Try to build one of them
    let hasNewImage = await BuildMeteorImage.tryBuildMeteorImage(gitHubMeteorReleases, dockerHubMeteorImages);

    if (hasNewImage) {
      // Fetch again, there might be an update by now
      dockerHubMeteorImages = await DockerHub.getDockerHubTagNames(Config.DOCKER_METEOR_IMAGE);
    }

    // Get successfully tested Minimeteor images from Docker Hub
    let dockerHubBuildTestImages = await DockerHub.getDockerHubTagNames(Config.DOCKER_BUILD_TEST_IMAGE);

    // Try to test Minimeteor-docker
    await TestMinimeteorDocker.tryTestMinimeteorDocker(dockerHubBuildTestImages, dockerHubMeteorImages);

  }
  catch (ex) {
    Logger.error(ex);
  }

  Logger.debug("All done.");
  Util.cleanupDocker();
}

main().catch(err => Logger.error(err));
