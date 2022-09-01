// run this in a folder which has a "repos" folder containing all the repositories.
// e.g. by executing: deno run -A cloneAll.ts repos -f -i "\-service" -t <API_TOKEN>

import { copyFolder, fileExists, gitCommit, gitCreateBranch, gitPull, gitPush, sleep } from "./common.ts";

const repoRoot = "./repos";
const batchSize = 5;
const batchWaitMinutes = 40; // 40min should be enough

const errorOnPushRepos = [] as string[];
let batchIterator = 0;
for (const dirEntry of Deno.readDirSync(repoRoot)) {
  if (!dirEntry.isDirectory) continue;
  if (dirEntry.name === ".vscode") continue;
  const dir = repoRoot + "/" + dirEntry.name;

  // skip non-java services
  if (Array.from(Deno.readDirSync(dir)).every((x) => x.name !== "pom.xml")) {
    console.log(`${dirEntry.name} has no pom.xml. Deleting it...`);
    Deno.removeSync(dir, { recursive: true });
    continue;
  }

  // skip already converted repos
  if (Deno.readTextFileSync(dir + "/.gitignore").includes("# allow coding style and save actions config")) {
    console.log(`repo ${dir} has coding style already. removing...`);
    Deno.removeSync(dir, { recursive: true });
    continue;
  }

  console.log("processing " + dirEntry.name);
  batchIterator++;

  await gitPull(dir); // to not have conflicts when pushing

  // if we have codeowners we probably do not have push rights on master, let's create a PR/branch then
  // TODO: automatically create PR for these
  if (fileExists(`${dir}/.github/codeowners`)) {
    await gitCreateBranch("BG-58-save_actions-settings", dir);
  }

  await excludeIdeaFolderInGitignore(dir);
  await gitCommit("🎨 remove .idea from .gitignore", dir);

  await copyFolder(".idea", dir);
  await gitCommit("🎨 add save_actions and coding style settings", dir);

  await addIdeaFolderInGitignore(dir);
  await gitCommit("🎨 add .idea back to .gitignore", dir);

  const { success } = await gitPush(dir);
  if (success) {
    Deno.removeSync(dir, { recursive: true });
  } else {
    errorOnPushRepos.push(dir);
  }

  await waitSomeTimeIfBatchSizeWasReached();
}
console.log("Finished all repos 🏁");
if (errorOnPushRepos.length != 0) {
  console.error("But was unable to push these repos:");
  errorOnPushRepos.forEach((x) => console.log(x));
}

async function excludeIdeaFolderInGitignore(dir: string) {
  let gitIgnore = Deno.readTextFileSync(dir + "/.gitignore");
  gitIgnore = gitIgnore.replaceAll(".idea\n", "");
  if (!gitIgnore.includes("!/.idea/codeStyles/*")) {
    gitIgnore += `
# allow coding style and save actions config
!/.idea/codeStyles/*
!/.idea/inspectionProfiles/*
!/.idea/saveactions_settings.xml
`;
  }
  await Deno.writeTextFile(dir + "/.gitignore", gitIgnore);
}

async function addIdeaFolderInGitignore(dir: string) {
  const gitIgnore = Deno.readTextFileSync(dir + "/.gitignore").replaceAll("*.iml\n", "*.iml\n.idea\n");
  await Deno.writeTextFile(dir + "/.gitignore", gitIgnore);
}

async function waitSomeTimeIfBatchSizeWasReached() {
  if (batchIterator >= batchSize) {
    const time = new Date().toLocaleTimeString();
    console.log(
      `\nReached batchsize of ${batchSize} at ${time}. Waiting ${batchWaitMinutes} minutes...  (errorOnPushRepos: ${errorOnPushRepos.length})`
    );
    await sleep(batchWaitMinutes);
    batchIterator = 0;
  }
}
