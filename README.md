
## Setup
### Install dependencies
1. Install [nvm](https://github.com/nvm-sh/nvm)
2. Install [circom](https://docs.circom.io/getting-started/installation/)

## Vote
```shell
nvm use
npm install
npm run postinstall
npx hardhat run scripts/vote.ts
```

## Deploy(Verify) on optimism-goerli
```shell
    ONLY_DEPLOY=1 npx hardhat run scripts/vote.ts --network opGoerli
```

## Upgrade(Verify) on optimism-goerli
```shell
    ONLY_UPGRADE=1 npx hardhat run scripts/vote.ts --network opGoerli
```

## Deploy on consesus zkevm
```shell
    ONLY_DEPLOY=1 npx hardhat run scripts/vote.ts --network consesusZkevmGoerli
```

   
