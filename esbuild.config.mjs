import esbuild from "esbuild";
import process from "node:process";
import builtins from "builtin-modules";

const production = process.argv.includes("production");

const context = await esbuild.context({
  bundle: true,
  entryPoints: ["main.ts"],
  external: [
    "obsidian",
    "electron",
    "@codemirror/autocomplete",
    "@codemirror/collab",
    "@codemirror/commands",
    "@codemirror/language",
    "@codemirror/lint",
    "@codemirror/search",
    "@codemirror/state",
    "@codemirror/view",
    ...builtins
  ],
  format: "cjs",
  platform: "node",
  target: "es2020",
  sourcemap: production ? false : "inline",
  treeShaking: true,
  outfile: "main.js",
  logLevel: "info"
});

if (production) {
  await context.rebuild();
  await context.dispose();
} else {
  await context.watch();
}
