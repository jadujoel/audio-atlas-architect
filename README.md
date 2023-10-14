
# Encoder

## Example

```bash
build # build the project
audio-atlas-architect config.mjs --force # remove the cache then build
audio-atlas-architect config.mjs --clean # remove the built files
audio-atlas-architect config.mjs --clean --build # remove the built files then build
audio-atlas-architect config.mjs --clean --force # remove the built files and the cache
audio-atlas-architect config.mjs --clean --force --build # remove the built files, cache, and the build
```

## Creating your config

If you want to use .json for the config you can add `"$schema": "node_modules/sound-encoder/schema.json"` to you config.json

```json
{
  "$schema": "node_modules/audio-atlas-architect/schema.json",
  "name": "sounds",
  "concurrency": 4,
  "cache": ".cache",
  "rootdir": "sounds",
  "outdir": "public/assets/sounds",
  "banks": {
    "common": {
      "base": "/assets/sounds/common",
      "rootdir": "sounds/common",
      "outdir": "public/assets/sounds/common",
      "media": {
        "effects": {
          "channels": 2,
          "bitrate": 64,
          "localization": []
        }
      }
    },
    "unicorn": {
      "base": "/assets/sounds/unicorn",
      "rootdir": "sounds/unicorn",
      "outdir": "public/assets/sounds/unicorn",
      "extends": "common",
      "media": {
        "music": {
          "channels": 2,
          "bitrate": 80,
          "localization": []
        },
        "effects": {
          "channels": 2,
          "bitrate": 64,
          "localization": []
        },
        "voice": {
          "channels": 1,
          "bitrate": 32,
          "localization": ["*"]
        }
      }
    }
  },
  "legacy_support": true
}


```
