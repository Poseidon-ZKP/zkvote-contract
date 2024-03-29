zkVote demo
===========

## Developer Setup

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

```sh
yarn hardhat test
```

### Command-line Demo

<img width="836" alt="image" src="https://github.com/Poseidon-ZKP/zkvote-contract/assets/7463414/0ef2c924-053b-411b-8126-805c353f41d5">

(Note, many of these commands are long-running and must be launched in their
own terminal).

Launch a development blockchain node:
```sh
yarn hardhat node
```

Create a `.env` file with the following content:
```env
KEYFILE_PASSWORD = abc123
```

Create 4 keyfiles with the following commands:
```sh
yarn ts-node scripts/encrypt_private_key.ts ./cli-demo/signer_private_key.txt -p abc123 -k ./cli-demo/signer.keyfile.json
```
```sh
yarn ts-node scripts/encrypt_private_key.ts ./cli-demo/alice_private_key.txt -p abc123 -k ./cli-demo/alice.keyfile.json
```
```sh
yarn ts-node scripts/encrypt_private_key.ts ./cli-demo/bob_private_key.txt -p abc123 -k ./cli-demo/bob.keyfile.json
```
```sh
yarn ts-node scripts/encrypt_private_key.ts ./cli-demo/carol_private_key.txt -p abc123 -k ./cli-demo/carol.keyfile.json
```

Deploy the contracts and write the configuration to files `nouns.config.json`, `zkv.config.json`, `dkg.config.json`.
These files are read by later commands to connect to the contract.

```sh
yarn ts-node scripts/deploy_dkg_zkvote.ts ./cli-demo/signer.keyfile.json ./cli-demo/committee_file_demo.json
```
```sh
yarn ts-node scripts/deploy_dummy_nouns.ts ./cli-demo/signer.keyfile.json
```

Launch 3 committee daemons (each in it's own terminal, as the process will not
terminate until votes are tallied).  For demo purposes, we set the tally to be
triggered when the total voting weight reaches 10. Alternatively, it can be run with no `-v` flag and only committee member number parameter. In this case, tally will trigger when `endBlock` is reached.

```sh
yarn ts-node scripts/committee.ts ./cli-demo/alice.keyfile.json -v 10
```
```sh
yarn ts-node scripts/committee.ts ./cli-demo/bob.keyfile.json -v 10
```
```sh
yarn ts-node scripts/committee.ts ./cli-demo/carol.keyfile.json -v 10
```

In a new terminal, setup a vote with proposal Id 1 and end block 1234, register some dummy voters and cast votes up to a total voting weight above 10
(max total voting weight is 20).  For example:
```sh
yarn ts-node scripts/setup_vote.ts 1 1234 ./cli-demo/signer.keyfile.json
```

```sh
yarn ts-node scripts/vote.ts 1 yay 6 ./cli-demo/alice.keyfile.json
```
```sh
yarn ts-node scripts/vote.ts 1 nay 3 ./cli-demo/bob.keyfile.json
```
```sh
yarn ts-node scripts/vote.ts 1 yay 5 ./cli-demo/carol.keyfile.json
```

When the committee commands notice that the total voting weight used is at
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

## Development

Run syntax checkers and linters:
```sh
yarn run check
```

Use `tsfmt` and `prettier-plugin-solidity` to format all code.  Run these manually with:
```sh
yarn run format
```
