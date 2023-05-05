zkVote demo
===========

## Developer Setup

### Install dependencies

1. Install [circom](https://docs.circom.io/getting-started/installation/)
2. Run `yarn`

### Build

```console
yarn build
yarn tsc
```

### Run demo

```console
yarn test
```

### Unit tests

```console
yarn hardhat test
```

<!-- ## Vote -->
<!-- ```shell -->
<!-- nvm use -->
<!-- npm install -->
<!-- npm run postinstall -->
<!-- npx hardhat run scripts/vote.ts -->
<!-- ``` -->

<!-- ## Deploy(Verify) on optimism-goerli -->
<!-- ```shell -->
<!--     ONLY_DEPLOY=1 npx hardhat run scripts/vote.ts --network opGoerli -->
<!-- ``` -->

<!-- ## Upgrade(Verify) on optimism-goerli -->
<!-- ```shell -->
<!--     ONLY_UPGRADE=1 npx hardhat run scripts/vote.ts --network opGoerli -->
<!-- ``` -->

<!-- ## Deploy on consesus zkevm -->
<!-- ```shell -->
<!--     ONLY_DEPLOY=1 npx hardhat run scripts/vote.ts --network consesusZkevmGoerli -->
<!-- ``` -->
