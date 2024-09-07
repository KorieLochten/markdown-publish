import typescript from "@rollup/plugin-typescript";
import resolve from "@rollup/plugin-node-resolve";
import commonjs from "@rollup/plugin-commonjs";
import postcss from "rollup-plugin-postcss";
const isProd = process.env.BUILD === "production";
import { resolve as pathResolve } from "path";
import builtins from "builtin-modules";
export default {
  input: "./src/main.ts",
  output: {
    dir: ".",
    sourcemap: "inline",
    sourcemapExcludeSources: isProd,
    format: "cjs",
    exports: "default"
  },
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
    "@lezer/common",
    "@lezer/highlight",
    "@lezer/lr",
    ...builtins
  ],
  plugins: [
    typescript(),
    resolve({
      extensions: [".js", ".jsx", ".ts", ".tsx"]
    }),
    commonjs(),
    postcss({
      extract: pathResolve("styles.css"),
      minimize: isProd,
      sourceMap: !isProd,
      modules: true
    })
  ]
};
