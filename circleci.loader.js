// @ts-check
const axios = require("axios").default;
const fs = require("fs");

function invariant(data, message) {
  return data
    .then((result) => {
      if (result == null) {
        return Promise.reject(new Error(message));
      }

      return result;
    })
    .catch((error) => Promise.reject(new Error(`${message}: ${error}`)));
}

async function getLatestWorkflow({ project, workflow, branch, client }) {
  const response = await client.get(
    `/insights/${project}/workflows/${workflow}`,
    {
      params: {
        branch,
      },
    }
  );

  return response.data.items.find((workflow) => workflow.status === "success");
}

async function getJob({ workflow, name, client }) {
  const response = await client.get(`/workflow/${workflow}/job`);

  return response.data.items.find((job) => job.name === name);
}

async function getSchemaArtifact({ project, job, path, client }) {
  const response = await client.get(`/project/${project}/${job}/artifacts`);

  return response.data.items.find((artifact) => artifact.path === path);
}

async function fetchContent(url) {
  const response = await axios.get(url);

  return response.data;
}

async function getSchema(config) {
  const client = axios.create({
    baseURL: "https://circleci.com/api/v2/",
    headers: {
      "Circle-Token": process.env.CIRCLECI_LOADER_TOKEN,
    },
  });
  const latestWorkflow = await invariant(
    getLatestWorkflow({
      project: config.project,
      workflow: config.workflow,
      branch: config.branch,
      client,
    }),
    "Failed to fetch latest workflow"
  );
  const job = await invariant(
    getJob({ workflow: latestWorkflow.id, name: config.job, client }),
    "Failed to fetch a job"
  );
  const artifact = await invariant(
    getSchemaArtifact({
      project: config.project,
      job: job.job_number,
      path: config.artifact,
      client,
    }),
    "Failed to fetch an artifact"
  );

  return await invariant(
    fetchContent(artifact.url),
    "Failed to fetch a schema"
  );
}

getSchema({
  project: process.env.CIRCLECI_LOADER_PROJECT,
  workflow: process.env.CIRCLECI_LOADER_WORKFLOW,
  branch: process.env.CIRCLECI_LOADER_BRANCH,
  job: process.env.CIRCLECI_LOADER_JOB,
  artifact: process.env.CIRCLECI_LOADER_ARTIFACT,
})
  .then((schema) => {
    fs.writeFileSync(process.env.CIRCLECI_LOADER_OUTPUT, schema, "utf-8");
    process.exit(0);
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
