/**
 * Tries to build Meteor docker images
 */

const tmp = require('tmp');
const fs = require('fs');
const rimraf = require('rimraf');

const Logger = require("./lib/logger.js");
const Version = require("./lib/version.js");
const Config = require("./lib/config.js");
const Util = require("./lib/util.js");

/**
 * Builds a Meteor image that was released but not yet built
 * @param gitHubMeteorReleases [string]  All released Meteor versions from GitHub
 * @param dockerHubMeteorImages [string]  All Meteor images from Docker Hub
 * @returns {Promise<boolean>}  True if a new image was built & pushed successfully
 */
async function tryBuildMeteorImage(gitHubMeteorReleases, dockerHubMeteorImages) {
  Logger.debug("---- build-meteor-image.js::tryBuildMeteorImage ----");
  try {
    let tag = findTagToBuild(gitHubMeteorReleases, dockerHubMeteorImages);
    if (!tag) return false;
    let success = await buildMeteor(tag);
    return success;
  }
  catch (ex) {
    Logger.error("Can't build Meteor image:", ex.toString());
  }
  return false;
}

/**
 * Returns a Meteor version that has been released but a Docker image was not yet built.
 * @param gitHubMeteorReleases [string]  All released Meteor versions from GitHub
 * @param dockerHubMeteorImages [string]  All Meteor images from Docker Hub
 * @return {string}  Meteor version to be built
 */
function findTagToBuild(gitHubMeteorReleases, dockerHubMeteorImages) {
  Logger.debug("Finding Meteor tag to build image from...");
  for (let tag of gitHubMeteorReleases) {
    if (dockerHubMeteorImages.find(x => x === tag)) continue;
    let version = Version.fromString(tag);
    if (!version || version.isSubversion || version.isLessThan([1, 3])) continue;
    return tag;
  }
  Logger.debug("No new releases found.");
  return null;
}


function buildMeteorDockerfile(meteorVersionString) {
  let releaseURL = "https://install.meteor.com/?release=" + meteorVersionString;
  let version = Version.fromString(meteorVersionString);

  let meteorCommandSwitches = [];
  if (version.isAtLeast([1, 4, 2]) && version.isLessThan([1, 4, 2, 1])) {
    meteorCommandSwitches.push("--unsafe-perm");
  }
  if (version.isAtLeast([1, 4, 2, 1])) {
    meteorCommandSwitches.push("--allow-superuser");
  }
  let meteorSwitch = meteorCommandSwitches.join(" ");

  // Installed packages:
  // - curl: to te able to download Meteor
  // - procps, python, g++, make: to build NPM libraries
  // - sudo: to run tools as non-root
  // - locales: for MongoDB
  // - libfontconfig: for PhantomJS (Meteor testing)
  return `# Dockerfile
FROM debian:jessie-slim
ENV DEBIAN_FRONTEND noninteractive

# Install tools
RUN apt-get -qq update \
 && apt-get -qq install curl procps python g++ make sudo locales libfontconfig git bzip2 >/dev/null \
 && apt-get clean \
 && locale-gen en_US.UTF-8 \
 && localedef -i en_GB -f UTF-8 en_US.UTF-8 \
 && curl ${releaseURL} | sh \
 && meteor node --version  # ${Date.now().toString()}
`;
}

/**
 * Builds a Meteor image
 * @param meteorVersion
 * @returns {Promise<boolean>}  True if a new image was built & pushed successfully
 */
async function buildMeteor(meteorVersion) {
  let dockerTag = `${Config.DOCKER_HUB_USER}/${Config.DOCKER_METEOR_IMAGE}:${meteorVersion}`;
  Logger.log("Building", dockerTag);

  // Create temp directory
  let tempDir = tmp.dirSync({prefix: 'minimeteor-'}).name;
  Logger.log("Using temp directory", tempDir);

  // Write Dockerfile into temp directory
  let content = buildMeteorDockerfile(meteorVersion);
  fs.writeFileSync(`${tempDir}/Dockerfile`, content);

  // Execute "docker build" command
  Logger.log("Running docker build...");
  let dockerProcess = await Util.spawnAsync("docker", ["build", "-t", dockerTag, tempDir]);

  // Remove temp directory
  Logger.error(`Removing temp directory ${tempDir}`);
  rimraf.sync(tempDir);

  // Send email about failure
  if (dockerProcess.exitCode) {
    Util.sendMail(`FAILED: ${dockerTag}`);
    Logger.error("Build failed. Exit code:", dockerProcess.exitCode);
    return false;
  }

  // Push docker image
  Logger.log("Pushing image to Docker Hub...");
  if (Util.exec(`docker push ${dockerTag}`)) {
    Util.sendMail(`FAILED: ${dockerTag} was built, but can't be sent to Docker Hub.`);
    Logger.error("Can't push image to Docker Hub:", dockerTag);
    return false;
  }

  Util.sendMail(`${dockerTag} built.`);
  Logger.log("Build successful:", dockerTag);
  return true;
}


module.exports = {
  tryBuildMeteorImage,
};