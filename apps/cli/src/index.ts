#!/usr/bin/env bun
import { defineCommand, runMain } from "citty";
import { authCommand } from "./commands/auth";
import { charactersCommand } from "./commands/characters";
import { galleryCommand } from "./commands/gallery";
import { generateCommand, jobsCommand } from "./commands/generate";
import { keysCommand } from "./commands/keys";
import { specCommand } from "./commands/spec";
import { themesCommand } from "./commands/themes";
import { globalArgDefs } from "./context";

const main = defineCommand({
  args: globalArgDefs(),
  meta: {
    description: "Charator CLI — character specs, generations, and gallery",
    name: "charator",
    version: "0.0.0",
  },
  subCommands: {
    auth: authCommand,
    characters: charactersCommand,
    gallery: galleryCommand,
    generate: generateCommand,
    jobs: jobsCommand,
    keys: keysCommand,
    spec: specCommand,
    themes: themesCommand,
  },
});

runMain(main);
