const { Octokit, App } = require('octokit');
const slugify = require('slugify');
const btoa = require('btoa');

// event.body expected to be:
// {
//   title: "Something",
//   image: "base64string="
//   imageExt: "png",
//   authorName: "Rune Madsen",
//   authorUrl: "https://runemadsen.com",
//   authorEmail: "rune@runemadsen.com",
//   url: "https://runemadsen.github.io/rune.js/",
//   challenge: "01-test",
// }

exports.handler = async function (event) {
  console.log('Handler called with: ', event.body);

  // Shared properties
  const postInfo = JSON.parse(event.body);
  const unix = Math.floor(Date.now() / 1000);
  const owner = 'CodingTrain';
  const repo = 'thecodingtrain.com';
  const showcasePath = `content/videos/challenges/${postInfo.challenge}/showcase`;
  const jsonPath = `${showcasePath}/contribution-${unix}.json`;
  const imagePath = `${showcasePath}/contribution-${unix}.${postInfo.imageExt}`;
  const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });

  /**
    Get the SHA of the main branch
  **/
  const shaRes = await octokit.request(
    `GET /repos/${owner}/${repo}/git/ref/heads/main`
  );
  console.log('shaRes', shaRes.status, shaRes.data);
  const mainSha = shaRes.data.object.sha;

  /**
    Make a new branch
  **/
  const branchName = slugify(
    `showcase-${slugify(postInfo.authorName)}-${unix}`.toLowerCase()
  );

  const branchRes = await octokit.request(
    `POST /repos/${owner}/${repo}/git/refs`,
    {
      ref: `refs/heads/${branchName}`,
      sha: mainSha
    }
  );
  console.log('branchRes', branchRes.status, branchRes.data);

  /**
    Add the JSON file
  **/
  const json = {
    title: postInfo.title,
    author: {
      name: postInfo.authorName
    },
    url: postInfo.url
  };

  if (postInfo.authorUrl) {
    json.author.url = postInfo.authorUrl;
  }

  const jsonContent = btoa(JSON.stringify(json, null, 2));

  const jsonOpts = {
    branch: branchName,
    message: 'Added contribution JSON file',
    content: jsonContent
  };

  if (postInfo.authorName && postInfo.authorEmail) {
    jsonOpts.committer = {
      name: postInfo.authorName,
      email: postInfo.authorEmail
    };
  }

  const jsonRes = await octokit.request(
    `PUT /repos/${owner}/${repo}/contents/${jsonPath}`,
    jsonOpts
  );
  console.log('jsonRes', jsonRes.status, jsonRes.data);

  /**
    Add the image
  **/
  const imageOpts = {
    branch: branchName,
    message: 'Added contribution image file',
    content: postInfo.image
  };

  if (postInfo.authorName && postInfo.authorEmail) {
    imageOpts.committer = {
      name: postInfo.authorName,
      email: postInfo.authorEmail
    };
  }

  const imageRes = await octokit.request(
    `PUT /repos/${owner}/${repo}/contents/${imagePath}`,
    imageOpts
  );
  console.log('imageRes', imageRes.status, imageRes.data);

  /**
    Make a PR to main
  **/
  const prRes = await octokit.request(`POST /repos/${owner}/${repo}/pulls`, {
    title: `Passenger showcase contribution from ${postInfo.authorName}`,
    body: 'Yay!',
    head: branchName,
    base: 'main'
  });
  console.log('prRes', prRes.status, prRes.data);
};
