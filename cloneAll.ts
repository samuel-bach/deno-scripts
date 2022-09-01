/**
 * Clones all specified, non-archived flowfact repositories.
 * usage: deno run -A cloneAll.ts repos -f -i "\-service" -t <GITHUB_API_TOKEN>
 */

// TODO:
// - make clear work on windows
// - extract cli tooling

import { ensureDir, existsSync } from "https://deno.land/std/fs/mod.ts";
import { parse } from "https://deno.land/std/flags/mod.ts";
import { gitClone, gitPull } from "./common.ts";

const helpAvailableHint = "\nHint: Help is available via --help argument.";
const args = {
  token: {
    short: "t",
    long: "token",
    mandatory: true,
    notFoundMsg: "No github token provided.",
    description: "The Github.com api token used to query the repositories",
    type: "",
  },
  pageSize: {
    short: "p",
    long: "pageSize",
    mandatory: false,
    default: 16,
    description: "The page sized used to query github.com and clone the repositories in parallel. Default: 16",
    type: 0,
  },
  exclude: {
    short: "e",
    long: "exclude",
    mandatory: false,
    default: "flowfact_performer",
    description: "Repositories that match with this regex are excluded. Default: flowfact_performer",
    type: "",
  },
  include: {
    short: "i",
    long: "include",
    mandatory: false,
    default: "",
    description: "Only repositories that match with this regex are included. Default: undefined",
    type: "",
  },
  clear: {
    short: "c",
    long: "clear",
    mandatory: false,
    default: false,
    description: "Delete everything inside the target directory before cloning. Default: false",
    type: false,
  },
  fullClone: {
    short: "f",
    long: "fullClone",
    mandatory: false,
    default: false,
    description: "If false will perform a shallow clone. Default: false",
    type: false,
  },
};

printHelpTextIfNeeded();
const targetDir =
  (parse(Deno.args)._?.[0] as string) ??
  errorExit(`No directory to clone into provided. Call with directory path as first argument.${helpAvailableHint}`);
const token = getArg(args.token) as typeof args.token.type;
const pageSize = getArg(args.pageSize) as typeof args.pageSize.type;
const exclude = new RegExp(getArg(args.exclude) as typeof args.exclude.type, "g");
const include = new RegExp(getArg(args.include) as typeof args.include.type, "g");
const clearDirectory = getArg(args.clear) as typeof args.clear.type;
const fullClone = getArg(args.fullClone) as typeof args.fullClone.type;

await ensureDir(targetDir);
if (clearDirectory) {
  console.log(`Cleaning target directory '${targetDir}'...`);
  await Deno.remove(targetDir, { recursive: true });
}

const startTime = performance.now();
console.log("Let's clone all of those Flowfact Repositories that are not archived! 🤠");

let i = 0;
let repoCount = 0;
const failedRepos = [] as string[];
let { repos, exhausted } = await getUnarchivedRepoUrls(i, pageSize, include, exclude);
while (!exhausted) {
  console.log(`Cloning batch no. ${i}, consisting of ${repos.length} items...`);
  const cloneProcesses = repos.map((x) => {
    const dir = `${targetDir}/${x.name}`;
    const process = existsSync(dir) ? gitPull(dir) : gitClone(x.clone_url, dir);

    return process.then((status) => {
      if (!status.success) {
        failedRepos.push(x.ssh_url);
        cleanupDir(dir);
      }
    });
  });

  await Promise.all(cloneProcesses);
  i += 1;
  repoCount += repos.length;
  ({ repos, exhausted } = await getUnarchivedRepoUrls(i, pageSize, include, exclude));
}

const failedMsg =
  failedRepos.length === 0
    ? ""
    : `\n${
        failedRepos.length
      } repos encountered an error while cloning! These repos could not be cloned/pulled:\n${failedRepos.join(
        "\n"
      )}\nYou can try running the command again, already existing repos will not be cloned again.`;

const duration = roundTwoDecimals((performance.now() - startTime) / 1000 / 60);

console.log(
  `\nFinished cloning/pulling ${repoCount - failedRepos.length} repositories in ${duration} minutes ${failedMsg}`
);

async function cleanupDir(dir: string) {
  try {
    existsSync(dir) && (await Deno.remove(dir, { recursive: true }));
  } catch (err) {
    console.error("could not cleanup dir: " + dir, err);
  }
}

function roundTwoDecimals(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function errorExit(msg: string, obj: unknown = "DeFvAlUe") {
  if (obj !== "DeFvAlUe") console.error("Error: " + msg, obj);
  else console.error("Error: " + msg);
  return Deno.exit(1);
}

async function getUnarchivedRepoUrls(page: number, pageSize: number, include: RegExp, exclude: RegExp) {
  try {
    const result = await fetch(`https://api.github.com/orgs/FLOWFACTCorp/repos?page=${page}&per_page=${pageSize}`, {
      headers: { Authorization: `token ${token}` },
    });
    if (!result.ok) {
      throw Error(`Server answered ${result.status} ${result.statusText ? ": " + result.statusText : ""}`);
    }
    const repos = (await result.json()) as {
      archived: boolean;
      ssh_url: string;
      clone_url: string;
      name: string;
    }[];
    return {
      exhausted: !repos?.length,
      repos: repos
        .filter((x) => x.archived === false)
        .filter((repo) => !repo.name.match(exclude) && repo.name.match(include)),
    };
  } catch (error) {
    return errorExit("could not fetch from github\n", error);
  }
}

function printHelpTextIfNeeded() {
  const flags = parse(Deno.args);
  if (flags["help"] ?? flags["h"]) {
    const argsText = Object.entries(args)
      .map(([_, arg]) => {
        return `-${arg.short}  --${arg.long}\t${arg.description}`;
      })
      .join("\n");

    console.log(`
Shallow clone and pull all Flowfact repositories that you have access to.

Usage: <cmd> <directoryToCloneInto> -t <YourGithubApiToken>

Arguments:
${argsText}
`);
    Deno.exit();
  }
}

function getArg(arg: Argument) {
  const flags = parse(Deno.args);
  const value = flags[arg.long] ?? flags[arg.short] ?? arg.default;
  if (arg.mandatory && value === undefined) {
    errorExit(`${arg.notFoundMsg} Use --${arg.long} or -${arg.short} argument.${helpAvailableHint}`);
  }
  if (typeof value !== typeof arg.type) {
    errorExit(
      `Argument '${
        arg.long
      }' has to be a ${typeof arg.type} but is actually a ${typeof value}. Parsed value: ${value}${helpAvailableHint}`
    );
  }
  return value as typeof arg.type;
}

type Argument = {
  short: string;
  long: string;
  mandatory: boolean;
  default?: string | number | boolean;
  notFoundMsg?: string;
  type: string | number | boolean /** just a dummy value for runtime assertion */;
};
