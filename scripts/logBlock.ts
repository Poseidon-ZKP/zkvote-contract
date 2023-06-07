import { logCurrentBlockNumber } from  "./utils/common";

async function log() {
  await logCurrentBlockNumber();
}

log();
