
import { CommitteeMember } from "./committee_member";
import { Round1Result } from "./round1";
import { expect } from "chai";
import { Contract } from "ethers";
import { generate_zkp_round2 } from "./prover";


type Round2Result = {
  members: CommitteeMember[];
}


export async function round2(
  nc: Contract,
  round1_result: Round1Result,
): Promise<Round2Result> {
  // Each committee member encrypts the shares for every other committee
  // member.

  const members = round1_result.members;
  const N_COM = members.length;
  for (let sender_idx = 0; sender_idx < N_COM; sender_idx++) {

    const sender = members[sender_idx];
    const sender_id = sender.id;
    const C_coefffs = sender.getCoefficientCommitments();

    for (let recip_idx = 0; recip_idx < N_COM; recip_idx++) {

      const recipient = members[recip_idx];
      const recip_id = recipient.id;

      console.log("ROUND2: sender: " + sender_id + " --> recip: " + recip_id);

      // Generate the encryption eph_sk outside of the encryption
      // function, since it's required for witness generation.

      const recip_PK = (await nc.get_round1_PK_for(recip_id)).map((x: bigint) => x.toString());
      expect(recip_PK).to.eql(recipient.getRound2PublicKey());
      const {f_i_l, PK_i_l} = sender.computeRound2ShareFor(recip_id);
      const {eph_sk, eph_pk, enc} = sender.encryptRound2ShareFor(f_i_l, recip_PK);
      console.log("  f_i_l = " + f_i_l.toString());

      // Check the decryption

      {
        const dec = recipient.decryptRound2Share(enc, eph_pk);
        expect(dec).to.equal(f_i_l);
      }

      // TODO: Add the commitment to the shares

      // Send the share to recipient, with proof.

      const {proof} = await generate_zkp_round2(
        recip_id,
        recip_PK,
        C_coefffs,
        f_i_l,
        PK_i_l,
        eph_sk,
        enc,
        eph_pk,
      )

      expect(await nc.round2_complete()).to.be.false;
      expect(await nc.round2_share_received(sender.id, recipient.id)).to.be.false;
      await (await nc.connect(sender.signer).round2(
        recip_id,
        enc,
        eph_pk,
        PK_i_l,
        proof.a,
        proof.b,
        proof.c,
        // proof
      )).wait()
      expect(await nc.round2_share_received(sender.id, recipient.id)).to.be.true;
    }
  }

  expect(await nc.round2_complete()).to.be.true;

  // Each participant pulls his encrypted shares from the contract events,
  // and reconstructs his final secret share.

  let committee_members: CommitteeMember[] = [];
  for (let sender_idx = 0; sender_idx < N_COM; sender_idx++) {
    const sender = members[sender_idx];
    const member = await sender.constructSecretShare();
    expect(member).is.not.null;
    committee_members.push(member);
  }

  console.log("round 2 done!!")

  return { members: committee_members };
}
