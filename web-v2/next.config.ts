import type { NextConfig } from "next";

const config: NextConfig = {
  // the pipeline lives in the p88-core workspace package, shared with the CLI.
  // It ships as TypeScript, so Next has to compile it.
  transpilePackages: ["p88-core"],
  serverExternalPackages: ["sharp"],

  /**
   * Phones reach this over the LAN, not on localhost.
   *
   * Next blocks cross-origin requests to dev resources by default, which kills
   * the HMR socket when the page is opened by IP. The dev client then retries
   * and reloads on a loop — which is why the phone looked like it was
   * "refreshing constantly" and why nothing responded to a tap: React never
   * got far enough to attach handlers.
   *
   * Covers the common home/office private ranges plus the Mac's own .local
   * name, so a DHCP lease change does not break it again. Development only —
   * `next build` ignores this entirely.
   */
  allowedDevOrigins: [
    "192.168.1.106",
    "192.168.*.*",
    "10.*.*.*",
    "172.16.*.*",
    "ITs-MacBook-Pro-3.local",
  ],
};

export default config;
