#!/usr/bin/env node

import { readFileSync } from "fs";

function escapeTemplateLiteral(str: string): string {
  return str
    .replace(/\\/g, "\\\\") // backslashes
    .replace(/`/g, "\\`") // backticks
    .replace(/\$(?=([a-zA-Z]|\{))/g, "\\$"); // dollar signs
}

function embed(filePath: string): string {
  const raw = readFileSync(filePath, "utf8");
  const content = escapeTemplateLiteral(raw);
  return `export default \`\n${content}\n\` as const;`;
}

// ----------- Entry Point -----------

const [, , inputFile] = process.argv;

if (!inputFile) {
  console.error("Usage: embed-files.ts <file-to-embed>");
  process.exit(1);
}

try {
  const tsCode = embed(inputFile);
  console.log(tsCode);
} catch (err) {
  console.error(`Error embedding file "${inputFile}":`, (err as Error).message);
  process.exit(1);
}
