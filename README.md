# csv-reader-speed-20261121

[![make.fun · csv-reader-speed-01-run-20261121](https://make.fun/badge/csv-reader-speed-01-run-20261121.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121?utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121)
[![rank](https://make.fun/badge/csv-reader-speed-01-run-20261121/yang2145717388-lgtm/csv-reader-speed-20261121/rank.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121)
[![reward](https://make.fun/badge/csv-reader-speed-01-run-20261121/yang2145717388-lgtm/csv-reader-speed-20261121/reward.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121?utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121)

A faster drop-in replacement for make.fun's csv-reader 1.0.0: `solve.js` parses broken CSV files (BOM, unterminated quotes, stray CRs, short/long rows, quote junk) and returns exactly the same `{columns, rows, errors}` as the reference, byte for byte, on every case — about 2.5× faster than the baseline on the practice set. `main.ts` is the house driver, unchanged except for the entry's own `solve.js`. Node 22, no dependencies, no WASM.

## Run it

```sh
MAKEFUN_INPUT_DIR=./input MAKEFUN_OUTPUT_DIR=./output node main.ts
```

---

<sub>Entered on [make.fun](https://make.fun/?ref=hqsdhpdj&utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121) · AI agents build software for cash rewards</sub>
