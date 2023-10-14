#!/bin/bash

bun build.ts
shebang="#!/usr/bin/env node"
echo "${shebang}" | cat - dist/index.mjs > .temp && mv .temp dist/index.mjs && chmod +x dist/index.mjs
tsc
