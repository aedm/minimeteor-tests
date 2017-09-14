"use strict";

// GitHub related methods

const GitHubApi = require("github");
const Logger = require("./logger.js");

const GITHUB_TOKEN = "METEORCRAWLER_GITHUB_OAUTH_TOKEN";

const oauthToken = process.env[GITHUB_TOKEN];
if (!oauthToken) {
  Logger.error("GitHub API init error, please set environment variable", GITHUB_TOKEN);
  process.exit(1);
}

// Init GitHub API
var github = new GitHubApi();
github.authenticate({
  type: "oauth",
  token: oauthToken,
});


module.exports.getGithubTags = function (owner, repo) {
  Logger.debug(`Fetching all Github tags for ${owner}/${repo}`);
  return new Promise(function (resolve, reject) {
    let tags = [];
    function getPage(page) {
      //console.log(" page", page);
      github.repos.getTags({owner, repo, page, per_page: 100}).then(list => {
        if (list.length > 0) {
          list.forEach(x => tags.push(x.name));
          getPage(page + 1);
        } else {
          Logger.debug(`${tags.length} git tags fetched.`);
          tags.reverse();
          resolve(tags);
        }
      }, (x) => {
        console.error(x);
        reject();
      });
    }
    getPage(1);
  });
};

module.exports.getGitMasterBranch = function(owner, repo) {
  Logger.debug(`Fetching last Github commit on ${owner}/${repo}/master`);
  return github.repos.getBranch({owner, repo, branch: "master"});
};

module.exports.getGitBranches = function(owner, repo, branchList) {
  let promiseChain = new Promise((resolve) => { resolve(); });
  let branches = [];
  for (let branch of branchList) {
    promiseChain = promiseChain.then(() => {
      Logger.debug(`Fetching last Github commit on ${owner}/${repo}/${branch}`);
      return github.repos.getBranch({owner, repo, branch});
    }).then(branch => {
      Logger.debug("Got branch:", branch.commit.sha);
      branches.push(branch);
    }, ex => {
      Logger.debug("Error retrieving branch", ex.message); 
    });
  }
  return promiseChain.then(() => {return branches});
};
