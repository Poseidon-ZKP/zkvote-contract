poseidon-zk-contracts
=====================
The missing zk contracts layer for Ethereum.

## Contracts
<table>
    <th>Contract</th>
    <th>Version</th>
    <th>Audit</th>
    <th>Trusted Setup</th>
    <tbody>
        <tr>
            <td>  
                zkGroup
            </td>
            <td>
                0.5.0
            </td>
            <td>
                :construction:
            </td>
            <td>
                not started
            </td>
        </tr>
        <tr>
            <td>
                zkSignal
            </td>
            <td>
               0.5.0
            </td>
            <td>
               :construction:
            </td>
            <td>
                not started
            </td>
        </tr>
        <tr>
            <td>
                zkShuffle
            </td>
            <td>
                0.5.0
            </td>
            <td>
               :construction: 
            </td>
            <td>
                not started
            </td>
        </tr>
    <tbody>
</table>

## Deploy Contracts
TBD

## Developer Setup
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

   