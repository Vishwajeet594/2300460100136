const fs = require("node:fs");
const path = require("node:path");

const levels = new Set(["debug", "info", "warn", "error", "fatal"]);

function ensureLogDirectory() {
  const directory = path.join(process.cwd(), "logs");
  if (!fs.existsSync(directory)) {
    fs.mkdirSync(directory, { recursive: true });
  }
  return directory;
}

function Log(stack, level, pkg, message, metadata = {}) {
  const normalizedLevel = levels.has(level) ? level : "info";
  const entry = {
    timestamp: new Date().toISOString(),
    stack,
    level: normalizedLevel,
    package: pkg,
    message,
    metadata
  };

  const filePath = path.join(ensureLogDirectory(), "application.jsonl");
  fs.appendFileSync(filePath, `${JSON.stringify(entry)}\n`, "utf8");
  return entry;
}

module.exports = { Log };
