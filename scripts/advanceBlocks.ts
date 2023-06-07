import { advanceBlocks } from "./utils/common";

async function advance() {
    // process.argv[2] will be the first command-line argument
    const numBlocks = process.argv[2] ? parseInt(process.argv[2]) : 1;
    await advanceBlocks(numBlocks);
}

advance();