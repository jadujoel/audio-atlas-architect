#!/bin/bash

npx pbjs bank.proto --ts src/protobuf/bank.ts
bun build.ts
shebang="#!/usr/bin/env node"
echo "${shebang}" | cat - dist/index.mjs > .temp && mv .temp dist/index.mjs && chmod +x dist/index.mjs
bun tsc --project tsconfig.json &
bun tsc --project src/protobuf/tsconfig.json &
