import type { NextConfig } from "next";

const config: NextConfig = {
  // the pipeline lives in the p88-core workspace package, shared with the CLI.
  // It ships as TypeScript, so Next has to compile it.
  transpilePackages: ["p88-core"],
  serverExternalPackages: ["sharp"],
};

export default config;
