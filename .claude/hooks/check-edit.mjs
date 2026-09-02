// PostToolUse hook: hold an edited file to the two gates that would otherwise
// fail at commit time - the ASCII rule and Prettier - and report them while the
// change is still in hand rather than three commits later.
//
// Reads the hook event as JSON on stdin. Exit 2 hands the message back to the
// agent; anything else is silent.
import { readFileSync } from "node:fs";
import path from "node:path";

// The files the pre-commit hooks cover.
const CHECKED = /\.(m?js|json|md|ya?ml)$/i;

// Translations are legitimately not ASCII; the changelog and the lockfile are
// generated.
const ASCII_EXEMPT = [/\/i18n\//, /(^|\/)CHANGELOG\.md$/, /(^|\/)package-lock\.json$/];

function hasNonAscii(line) {
  for (const character of line) {
    if (character.codePointAt(0) > 127) {
      return true;
    }
  }
  return false;
}

async function readStdin() {
  const chunks = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString("utf8");
}

async function main() {
  let event;
  try {
    event = JSON.parse(await readStdin());
  } catch {
    return 0;
  }

  const file = event && event.tool_input && event.tool_input.file_path;
  if (!file || !CHECKED.test(file)) {
    return 0;
  }

  let source;
  try {
    source = readFileSync(file, "utf8");
  } catch {
    return 0;
  }

  const posix = file.split(path.sep).join("/");
  const problems = [];

  if (!ASCII_EXEMPT.some((pattern) => pattern.test(posix))) {
    const at = source.split("\n").findIndex(hasNonAscii);
    if (at !== -1) {
      problems.push(
        `line ${at + 1} has a non-ASCII character. Source stays ASCII outside lib/i18n/; ` +
          "use plain hyphens and quotes."
      );
    }
  }

  // Prettier is asked in process rather than through npx: it is a devDependency
  // here, and spawning a package runner on every edit is not worth the wait.
  try {
    const prettier = await import("prettier");
    const info = await prettier.getFileInfo(file, { ignorePath: ".prettierignore" });
    if (!info.ignored && info.inferredParser) {
      const options = await prettier.resolveConfig(file);
      const formatted = await prettier.check(source, { ...options, filepath: file });
      if (!formatted) {
        problems.push("Prettier would reformat this file. Run `npm run format` before committing.");
      }
    }
  } catch {
    // No Prettier installed, or it could not read its own config: leave it to CI.
  }

  if (problems.length === 0) {
    return 0;
  }

  const relative = path.relative(process.cwd(), file) || file;
  process.stderr.write(`${relative}\n- ${problems.join("\n- ")}\n`);
  return 2;
}

main().then(
  (code) => process.exit(code),
  () => process.exit(0)
);
