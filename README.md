zkVote demo
===========

## Developer Setup

### Install dependencies

1. Install [circom](https://docs.circom.io/getting-started/installation/)
2. Run `yarn`

## Download ptau file
From the [snarkjs](https://github.com/iden3/snarkjs) repo, download the power 16 ptau file. Save the file as `ptau.16` in the `circuits` directory of this repo (i.e. the file should be located at `circuits/ptau.16`).

### Build

```console
yarn build
yarn tsc
```

### Run workflow test

```console
yarn test
```

### Unit tests

```console
yarn hardhat test
```

### Command-line Demo

(Note, many of these commands are long-running and must be launched in their
own terminal).

Launch a development blockchain node:
```console
$ yarn hardhat node
```

Deploy the contract and write the configuration to a file `nouns.config.json`.
This file is read by later commands to connect to the contract.

```console
$ yarn ts-node scripts/deploy.ts
```

Launch 3 committee daemons (each in it's own terminal, as the process will not
terminate until votes are tallied)

```console
$ yarn ts-node scripts/committee.ts 1
```
```console
$ yarn ts-node scripts/committee.ts 2
```
```console
$ yarn ts-node scripts/committee.ts 3
```

In a new terminal, register some dummy voters and cast votes up to a total voting weight above 10
(max total voting weight is 20).  For example:
```console
$ yarn ts-node scripts/vote.ts 1 yay 6
```
```console
$ yarn ts-node scripts/vote.ts 2 nay 3
```
```console
$ yarn ts-node scripts/vote.ts 3 yay 5
```

When the committee commands notice that the total voting weight used is at
least 10, they begin the tallying, and will exit after the tallying process is
complete.  To query the contract for the vote totals, run:

```console
$ yarn ts-node scripts/get_vote_tally.ts
```
