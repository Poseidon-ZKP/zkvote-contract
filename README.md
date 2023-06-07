zkVote demo
===========

## Developer Setup

### Install dependencies

1. Install [circom](https://docs.circom.io/getting-started/installation/)
2. Run `yarn`

### Download ptau file
```console
curl -o circuits/ptau.16 https://hermez.s3-eu-west-1.amazonaws.com/powersOfTau28_hez_final_16.ptau
```

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

Deploy the contracts and write the configuration to files `nouns.config.json`, `zkv.config.json`, `dkg.config.json`.
These files are read by later commands to connect to the contract.

```console
$ yarn ts-node scripts/deploy_dkg_zkvote.ts
$ yarn ts-node scripts/deploy_dummy_nouns.ts
```

Launch 3 committee daemons (each in it's own terminal, as the process will not
terminate until votes are tallied).  For demo purposes, we set the tally to be
triggered when the total voting weight reaches 10.

```console
$ yarn ts-node scripts/committee.ts -v 10 1
```
```console
$ yarn ts-node scripts/committee.ts -v 10 2
```
```console
$ yarn ts-node scripts/committee.ts -v 10 3
```

In a new terminal, setup a vote with proposal Id 1 and end block 12345678, register some dummy voters and cast votes up to a total voting weight above 10
(max total voting weight is 20).  For example:
```console
$ yarn ts-node scripts/setup_vote.ts 1 12345678
```

```console
$ yarn ts-node scripts/vote.ts 1 1 yay 6
```
```console
$ yarn ts-node scripts/vote.ts 1 2 nay 3
```
```console
$ yarn ts-node scripts/vote.ts 1 3 yay 5
```

When the committee commands notice that the total voting weight used is at
least 10, they begin the tallying, and will exit after the tallying process is
complete.  To query the contract for the vote totals for proposal Id 1, run:

```console
$ yarn ts-node scripts/get_vote_tally.ts 1
```

## Development

Run syntax checkers and linters:
```console
$ yarn run check
```

Use `tsfmt` and `prettier-plugin-solidity` to format all code.  Run these manually with:
```console
$ yarn run format
```
