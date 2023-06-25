zkVote demo
===========

## Background
This branch exists to integrate with the [Nouns DAO Private Voting front-end](https://github.com/0xDigitalOil/nounsdao-privatevoting#nounsdao-privatevoting) and needs to be running in parallel to the Nouns UI and contracts in that repo.

For more info and to get that repo running first (necessary), [see here](https://github.com/0xDigitalOil/nounsdao-privatevoting).

## Setup

### Install dependencies

1. Install [circom](https://docs.circom.io/getting-started/installation/)
2. Run `yarn`

### Download ptau file
```sh
curl -o circuits/ptau.16 https://hermez.s3-eu-west-1.amazonaws.com/powersOfTau28_hez_final_16.ptau
```

### Build

```sh
yarn build
yarn tsc
```

### Run workflow test

```sh
yarn test
```

### Unit tests
Note that these tests use a dummy instantiation of the nouns governance contract. Not a fork of the NounsDAOLogicV2 contract from the nounsdao-monorepo.
```sh
yarn hardhat test
```

## Command-line Demo
This command-line demo is optional (not necessary to run the full proof of concept). It's fully contained (i.e. doesn't presume a running instance of the nounsdao-monorepo).

Its purpose is to isolate a proof of concept of the Private Voting contracts by testing with a dummy Nouns governance contract and no GUI.

The demo might break the proof of concept workflow which starts in the nounsdao-monorepo because its prefferable to run it with a new hardhat node instance.

> **Note**
>
> Many of these commands are long-running and must be launched in their own terminal.

Launch a development blockchain node:
```sh
yarn hardhat node
```

Deploy the contracts and write the configuration to files `zkv.config.json`, `dkg.config.json`, `nouns.config.json`.
These files are read by later commands to connect to the contract.

In a new terminal:
```console
yarn ts-node scripts/deploy_dkg_zkvote.ts
```
```console
yarn ts-node scripts/deploy_dummy_nouns.ts
```

Launch 3 committee daemons (each in its own terminal, as the process for each will not
terminate until votes are tallied).  For demo purposes, we set the tally to be
triggered when the total voting weight reaches `10`. Alternatively, it can be run with no `-v` flag and only committee member number parameter. In both cases, tally can trigger when the proposal's `endBlock` is reached.

```sh
yarn ts-node scripts/committee.ts -v 10 1
```
```sh
yarn ts-node scripts/committee.ts -v 10 2
```
```sh
yarn ts-node scripts/committee.ts -v 10 3
```

In a new terminal, setup a vote with proposal Id 1 and end block 1234, register some dummy voters and cast votes up to a total voting weight above 10 (max total voting weight is 20). For example:

```sh
yarn ts-node scripts/setup_vote.ts 1 1234
```
```sh
yarn ts-node scripts/vote.ts 1 1 yay 6
```
```sh
yarn ts-node scripts/vote.ts 1 2 nay 3
```
```sh
yarn ts-node scripts/vote.ts 1 3 yay 5
```

When the committee daemons notice that the total voting weight used is at
least 10, they begin the tallying, and will exit after the tallying process is
complete.  

If voting weight threshold isn't met or wasn't set upon committee daemon setup, force hardhat to mine `N` blocks by running:

```sh
yarn ts-node scripts/advanceBlocks.ts N
```

For the example above, run with `N = 1234` to advance `1234` blocks and ensure `endBlock` is reached. If no `N` is passed, defaults to 1 block advanced.

To query the contract for the vote totals for proposal Id 1, run:

```sh
yarn ts-node scripts/get_vote_tally.ts 1
```

## Full Demo
The full demo presumes that the [nounsdao-mono repo instance](https://github.com/0xDigitalOil/nounsdao-privatevoting#nounsdao-privatevoting) has been run all the way through and that the setup described here above (with exception of the Command-line demo) was completed.

> **Note**
>
> Many of these commands are long-running and must be launched in their own terminal.

Remember that a local hardhat node is already running (from the nounsdao-monorepo setup).

Deploy the contracts and write the configuration to files `zkv.config.json`, `dkg.config.json`.
These files are read by later commands to connect to the contracts.

In a new terminal:
```console
yarn ts-node scripts/deploy_dkg_zkvote.ts
```

Launch 3 committee daemons (each in its own terminal, as the process for each will not
terminate until votes are tallied).  For demo purposes, we set the tally to be
triggered when the total voting weight reaches `10`. Alternatively, it can be run with no `-v` flag and only committee member number parameter. In both cases, tally will trigger anyway when the proposal's `endBlock` is reached.

```sh
yarn ts-node scripts/committee.ts -v 10 1
```
```sh
yarn ts-node scripts/committee.ts -v 10 2
```
```sh
yarn ts-node scripts/committee.ts -v 10 3
```

Ensure that voters 1, 2, 3 (defined in the nounsdao-monorepo) hold at least 1 Noun (via auction). 

Using the Nouns Private Voting UI create a new proposal (#1). 

Then execute each of the voters' votes like so:

```sh
yarn ts-node scripts/voteDAO.ts 1 1 yay 6
```
```sh
yarn ts-node scripts/voteDAO.ts 1 2 nay 3
```
```sh
yarn ts-node scripts/voteDAO.ts 1 3 yay 5
```

When the committee daemons notice that the total voting weight used is at
least 10, they begin the tallying, and will exit after the tallying process is
complete.  

However, since the nounsdao-monorepo is set up for very short voting periods, the vote tally will be triggered in only a couple minutes anyway when the proposal's `endBlock` is reached.

Once the voting period is done, view tally results in the Nouns DAO UI. If the proposal passed, try queueing and executing it.

<?
## Development

Run syntax checkers and linters:
```sh
yarn run check
```

Use `tsfmt` and `prettier-plugin-solidity` to format all code.  Run these manually with:
```sh
yarn run format
```
?>
