import {
  groupOrder, pointFromScalar, polynomial_evaluate,
  polynomial_evaluate_group
} from "../scripts/crypto";
import { expect } from "chai";
const { buildBabyjub } = require('circomlibjs');

describe("Committee Member", () => {

  let babyjub: any;

  before(async () => {
    babyjub = await buildBabyjub();
  });

  describe("polynomial_evaluate", () => {

    it("works", async function() {
      // f(x) = 3 + 2x + x^2
      const f = [3n, 2n, 1n];

      // f(0) == 3
      expect(polynomial_evaluate(f, 0n, 1000000n)).to.equal(3n);
      // f(1) == 6
      expect(polynomial_evaluate(f, 1n, 1000000n)).to.equal(6n);
      // f(10) == 123
      expect(polynomial_evaluate(f, 10n, 1000000n)).to.equal(123n);
      // f(10) == 2 mod 11
      expect(polynomial_evaluate(f, 10n, 11n)).to.equal(2n);
      // f(100) == 10203
      expect(polynomial_evaluate(f, 100n, 1000000n)).to.equal(10203n);
      // f(100) == 12 mod 43
      expect(polynomial_evaluate(f, 100n, 43n)).to.equal(12n);
      // f(110) == 12323
      expect(polynomial_evaluate(f, 110n, 1000000n)).to.equal(12323n);

      // g(x) = 3 + 5*x^11
      const g = [3n, 0n, 0n, 0n, 0n, 0n, 0n, 0n, 0n, 0n, 0n, 5n];

      // g(17) == 34271896307633 == 406041 mod 1000007
      // g(17) == 171359481538168 == 30194 mod 1000007
      expect(polynomial_evaluate(g, 17n, 1000007n)).to.equal(30194n);
    });

  });

  describe("polynomial_evaluate_group", () => {

    it("works", async function() {
      // f(x) = 30 + 31x
      const f = [30n, 31n];
      const f_C = f.map(x => pointFromScalar(babyjub, x));
      const x = 2n;

      const v = polynomial_evaluate(f, x, groupOrder(babyjub));
      const v_C = polynomial_evaluate_group(babyjub, f_C, x);

      const expect_v_C = pointFromScalar(babyjub, v);

      console.log("       v_C: " + v_C);
      console.log("expect_v_C: " + expect_v_C);

      expect(v_C).eql(expect_v_C);
    });

  });

});
