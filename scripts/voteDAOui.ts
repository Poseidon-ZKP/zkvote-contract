import * as nouns_contract from "./nouns/nouns_contract";
import { Vote, Voter, VoteRecordAndProof } from "./nouns/voterDAOui";
import * as dkg_contract from "./nouns/dkg_contract";
import { Nouns } from "./nouns/nouns_contract";
import { CommitteeMemberDKG, CommitteeMember } from "./nouns/committee_member";
import { command, run, number, string, positional, option } from 'cmd-ts';
import * as fs from 'fs';
import * as ethers from "ethers";
import { expect } from "chai";


function parse_vote(vote: string): Vote {
  switch (vote.toLowerCase()) {
    case "yay": return Vote.Yay;
    case "nay": return Vote.Nay;
    case "abstain": return Vote.Abstain;
    default: break;
  }

  throw "unrecognized vote: " + vote + ".  Use yay, nay or abstain.";
}


  export async function get_vote(proposal_id: number, dc_descriptor_file: string, nc_descriptor_file: string, endpoint: string, my_id: number, vote_str: string) : Promise<VoteRecordAndProof> {

    expect(my_id).is.greaterThan(0);

    const vote = parse_vote(vote_str);
    console.log("vote: " + vote);

    // Load descriptor file
    const dkg_descriptor: dkg_contract.DKGContractDescriptor = JSON.parse(
      fs.readFileSync(dc_descriptor_file, 'utf8'));

    const nouns_descriptor: nouns_contract.NounsContractDescriptor = JSON.parse(
      fs.readFileSync(nc_descriptor_file, 'utf8'));
    expect(my_id).is.lessThanOrEqual(dkg_descriptor.n_comm);

    // Connect
    const provider = new ethers.providers.JsonRpcProvider(endpoint);

    // Initialize the voter.  Assume committee members use accounts with index
    // 1 through n_comm (0 used for deployer).  Since voter indices are also
    // 1-based, voter 1 uses the signer with index n_comm + my_id.
    const signer_idx = dkg_descriptor.n_comm + my_id;
    const signer = provider.getSigner(signer_idx);
    const voter = await Voter.initialize(signer, nouns_descriptor);

    // Register the voter
    //await voter.dummy_register(proposal_id, BigInt(vote_weight));

    // Vote and wait
    const vote_record = await voter.cast_vote(proposal_id, vote);
    console.log(JSON.stringify(vote_record));

    return vote_record;
  }

