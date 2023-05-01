import { Round1Result } from "./round1";
import { expect } from "chai";
import { exit } from "process";
import { randomBytes } from "@ethersproject/random";
import { Contract } from "ethers";
import { hexlify } from "@ethersproject/bytes";
import { poseidonDecEx, poseidonEncEx } from "./poseidon";
import { generate_plonk_zkp_round2, generate_zkp_round2 } from "./prover";


type Round2Result = {
}


export async function round2(
  babyjub: any,
  poseidon: any,
  nc: Contract,
  round1_result: Round1Result,
  // COMMITEE: string[],
  // a,
  // f,
  // edwards_twist_C,
  // r2r,
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

      if (sender_idx == recip_idx) continue;

      const recipient = members[recip_idx];
      const recip_id = recipient.id;

      console.log("ROUND2: sender: " + sender_id + " --> recip: " + recip_id);

      // Generate the encryption eph_sk outside of the encryption
      // function, since it's required for witness generation.

      const {f_i_l, f_i_l_commit} = sender.computeRound2ShareFor(recip_id);
      const recip_PK = (await nc.get_round1_PK_for(recip_id)).map(x => x.toString());
      expect(recip_PK).to.eql(recipient.getRound2PublicKey());
      const {eph_sk, eph_pk, enc} = poseidonEncEx(babyjub, poseidon, f_i_l, recip_PK);
      console.log("  f_i_l = " + f_i_l.toString());

      // Create the encryption and eph_sk

      expect(
        poseidonDecEx(
          babyjub, poseidon, {eph_pk, enc}, recipient.getRound2SecretKey())
      ).to.equal(f_i_l);

      // Check the decryption

      {
        const recip_sk = recipient.getRound2SecretKey();
        const dec = poseidonDecEx(
          babyjub,
          poseidon,
          { eph_pk: eph_pk, enc: enc },
          recip_sk);
        expect(dec).equal(f_i_l)
      }

      // TODO: Add the commitment to the shares

      // Send the share to recipient.

      const {proof /*, publicSignals*/} = await generate_zkp_round2(
        recip_id,
        recip_PK,
        C_coefffs,
        f_i_l,
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
        proof.a,
        proof.b,
        proof.c,
        // proof
      )).wait()
      expect(await nc.round2_share_received(sender.id, recipient.id)).to.be.true;
    }
  }

  expect(await nc.round2_complete()).to.be.true;

  console.log("round 2 done!!")

  return {};
}
