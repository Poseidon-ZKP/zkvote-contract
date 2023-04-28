import { encryptedToString, poseidonEncEx, poseidonDecEx } from "../scripts/nouns/poseidon";
import { groupOrder, pointFromScalar } from "../scripts/crypto";

import { randomBytes } from "@ethersproject/random";
import { hexlify } from "@ethersproject/bytes";
const { buildPoseidonReference, buildBabyjub } = require('circomlibjs');
import { expect } from "chai";

describe("Encryption", () => {

  let babyjub: any;
  let poseidon: any;

  before(async () => {
    babyjub = await buildBabyjub();
    poseidon = await buildPoseidonReference();
  });

  describe("poseidonEnc", () => {

    it("should encrypt / decrypt messages ", async function() {

      const aliceSK = BigInt(hexlify(randomBytes(32))) % groupOrder(babyjub);
      const alicePK = pointFromScalar(babyjub, aliceSK);

      const msg = BigInt("12345678900987654321");

      // Encrypt
      const enc = (() => {
        const r = BigInt(hexlify(randomBytes(32))) % groupOrder(babyjub)
        return poseidonEncEx(babyjub, poseidon, msg, alicePK);
      })();
      console.log("enc: " + encryptedToString(enc));

      // Decrypt
      const dec = poseidonDecEx(babyjub, poseidon, enc, aliceSK);
      console.log("enc: " + dec.toString());

    });

  });

});
