#!/usr/bin/env node

const main = require("../build/exec/run-oracle").default

;(async () => {
  await main()
})().catch((err) => {
  console.log(err)
  process.exit(1)
})
