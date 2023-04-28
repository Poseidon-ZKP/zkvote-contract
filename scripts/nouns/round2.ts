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
  for (let i = 0; i < N_COM; i++) {

    const sender = members[i];
    const sender_id = sender.id;
    const C_coefffs = sender.getCoefficientCommitments();

    for (let l = 0; l < N_COM; l++) {

      if (i == l) continue;

      const recipient = members[l];
      const recipient_id = recipient.id;

      console.log("ROUND2: " + sender_id + " --> " + recipient_id);

      // Generate the encryption eph_sk outside of the encryption
      // function, since it's required for witness generation.

      const {f_i_l, f_i_l_commit} = sender.computeRound2ShareFor(recipient_id);
      const C_l_0 = recipient.getRound2PublicKey();
      const {eph_sk, eph_pk, enc} = poseidonEncEx(babyjub, poseidon, f_i_l, C_l_0);
      console.log("  f_i_l = " + f_i_l.toString());

      // Create the encryption and eph_sk
      expect(
        poseidonDecEx(
          babyjub, poseidon, {eph_pk, enc}, recipient.getRound2SecretKey())
      ).to.equal(f_i_l);

      // Check the decryption
      // const {dec} = await poseidonDec(enc, a[l][0], KB, jub)
      const recip_sk = recipient.getRound2SecretKey();
      const dec = poseidonDecEx(babyjub, poseidon, { eph_pk: eph_pk, enc: enc }, recip_sk);
      expect(dec).equal(f_i_l)

      // TODO: Add the commitment to the shares

      const {proof, publicSignals} = await generate_plonk_zkp_round2(
        f_i_l,
        recipient_id,
        C_coefffs,
        C_l_0,
        eph_sk,
        // enc,
        // edwards_twist_C[i],
        // edwards_twist_C[l][0],
        // r2r[i][l]
      )
      console.log("publicSignals: " + publicSignals);

      expect(BigInt(enc)).equal(BigInt(publicSignals.enc))
      expect(eph_pk[0]).equal(publicSignals.kb[0])
      expect(eph_pk[1]).equal(publicSignals.kb[1])


      // await (await nc.connect(COMMITEE[i]).round2(
      //   l, publicSignals.enc, publicSignals.kb, publicSignals.out, proof
      // )).wait()
      // console.log("round 2 on-chain verify done!!")
    }
  }

  // TODO : verify (recursive) aggregate plonk proof

  console.log("round 2 done!!")

  return {};
}
