"use strict";

/**
 * Docker HUB related functions
 */

const DockerHubAPI = require('docker-hub-api');
const Logger = require("./logger.js");
const Config = require("./config.js");

// Init Docker API
DockerHubAPI.setCacheOptions({enabled: true, time: 60});

async function getDockerHubFullTags(repo) {
  Logger.debug(`Fetching all Docker Hub tags for ${Config.DOCKER_HUB_USER}/${repo}`);
  let tags = [];
  for (let page = 1; ; page++) {
    try {
      let list = await DockerHubAPI.tags(Config.DOCKER_HUB_USER, repo, {page, perPage: 100});
      list.forEach(x => tags.push(x));
    }
    catch (ex) {
      break;
    }
  }
  Logger.debug(`${tags.length} Docker tags fetched.`);
  return tags;
}

async function getDockerHubTagNames(repo) {
  let tags = await getDockerHubFullTags(repo);
  return tags.map(x => x.name);
}

module.exports = {
  getDockerHubFullTags,
  getDockerHubTagNames,
};
