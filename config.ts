import type { EncodeConfig } from "./src/types";

export const config = {
  name: 'sounds',
  // concurrency: 4,
  cache: '.cache',
  rootdir: 'sounds',
  outdir: 'public/assets/sounds',
  banks: {
    common: {
      base: "/assets/sounds/common",
      rootdir: "sounds/common",
      outdir: "public/assets/sounds/common",
      default_language: '',
      media: {
        effects: {
          channels: 2,
          bitrate: 64,
          localization: []
        },
      }
    },
    unicorn: {
      base: "/assets/sounds/unicorn",
      rootdir: "sounds/unicorn",
      outdir: "public/assets/sounds/unicorn",
      extends: 'common',
      default_language: 'en',
      media: {
        music: {
          channels: 2,
          bitrate: 80,
          localization: []
        },
        effects: {
          channels: 2,
          bitrate: 64,
          localization: []
        },
        voice: {
          channels: 1,
          bitrate: 32,
          localization: ["*"],
        }
      }
    }
  },
  legacy_support: true
} as const satisfies EncodeConfig

export default config as EncodeConfig
