export function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function run(cmdArgs: string[], args?: { printStdOut?: boolean; printStdErr?: boolean }) {
  const p = Deno.run({ cmd: cmdArgs, stdout: "piped", stderr: "piped" });
  const stdOut = new TextDecoder().decode(await p.output());
  const stdErr = new TextDecoder().decode(await p.stderrOutput());
  if ((args?.printStdOut ?? true) && stdOut) console.log(stdOut);
  if ((args?.printStdErr ?? true) && stdErr) console.error(stdErr);
  return { status: await p.status(), stdOut, stdErr };
}

/**
 * Filesystem
 */

export function copyFolder(from: string, to: string) {
  return run(["cp", "-R", from, to]);
}

export function fileExists(path: string) {
  try {
    Deno.readFileSync(path);
    return true;
  } catch (_) {
    return false;
  }
}

/**
 * Git
 */

export function gitClone(url: string, dir = ".", shallow = false) {
  const depth = shallow ? ["--depth", "1"] : [];
  // const authenticatedUrl = url.replace("https://github.com", `https://${githubToken}:x-oauth-basic@github.com`);
  return run(["git", "clone", ...depth, url, dir]);
}

export function gitPull(dir = ".") {
  console.log(`pulling "${dir}"...`);
  return run(["git", "-C", dir, "pull", "--rebase"]);
}

// make sure to have this set if you want gitPush to also work for branches: git config --global push.autoSetupRemote true
export async function gitPush(dir = ".") {
  console.log(`pushing "${dir}"...`);
  return await run(["git", "-C", dir, "push"]);
}

export async function gitCommit(msg: string, dir = ".") {
  console.log(`committing "${dir}"...`);
  await run(["git", "-C", dir, "add", "."]);
  return await run(["git", "-C", dir, "commit", "-am", msg]);
}

export async function gitCreateBranch(branchName: string, dir = ".") {
  console.log(`creating branch ${branchName} in "${dir}"...`);
  return await run(["git", "-C", dir, "checkout", "-b", branchName]);
}
