import { pointAdd, polynomial_evaluate_group } from "../crypto";
import { CommitteeMemberDKG } from "./committee_member";
import { expect } from "chai";
import { Signer, Contract } from "ethers";


export type Round1Result = {
    members: CommitteeMemberDKG[],
    PK: any,
};


/// Given the committee, the threshold, and the voting contract,
///
/// For each participant i:
/// 1. create the $t$ random polynomial coefficients $\{ a_{i,j} \}$
/// 2. create the commitments to coefficients $\{ C_{i,j} \}$
export async function round1(
    babyjub: any,
    poseidon: any,
    commitee: Signer[],
    t: number,
    nc: Contract,
): Promise<Round1Result> {

    const n_comm = commitee.length;
    let i = 1;
    const members: CommitteeMemberDKG[] = commitee.map((signer) => {
        return CommitteeMemberDKG.initialize(babyjub, poseidon, nc, signer, n_comm, t, i++);
    });

    expect(await nc.round1_complete()).equal(false);

    await Promise.all(members.map(async (member) => {
        const Cs = member.getCoefficientCommitments();
        console.log("Cs: " + JSON.stringify(Cs));
        await nc.connect(member.signer).round1(Cs);
    }));

    // Sanity checks.
    // Compute the expected PK, and compare to the actual PK on the contract.

    expect(await nc.round1_complete()).equal(true);

    const expect_PK = (() => {
        let PK_sum = members[0].C_coeff_commitments[0];
        for (let i = 1 ; i < members.length ; ++i) {
            const member_C_0 = members[i].C_coeff_commitments[0];
            PK_sum = pointAdd(babyjub, PK_sum, member_C_0);
        }
        return PK_sum;
    })();
    const PK = (await nc.get_PK()).map((x: bigint) => x.toString());

    console.log("expect_PK: " + JSON.stringify(expect_PK));
    console.log("actual PK: " + JSON.stringify(PK));

    const PK_coeffs_sol = (await nc.PK_coefficients());
    const PK_coeffs = PK_coeffs_sol
        .map((xy: bigint[]) => [xy[0].toString(), xy[1].toString()]);
    console.log("PK_coeffs: " + JSON.stringify(PK_coeffs));

    members.forEach(member => {
        const pk_share = polynomial_evaluate_group(
            babyjub,
            PK_coeffs,
            BigInt(member.id));
        console.log("PK_share for " + member.id + ": " + pk_share);
    });

    expect(PK).eql(expect_PK);
    return {members, PK};

    // let a = []
    // let C = []
    // const edwards_twist_C = []  // [][][2]
    // for (let i = 0; i < commitee.length; i++) {
    //     a.push([])
    //     C.push([])
    //     edwards_twist_C.push([])
    //     for (let j = 0; j < t; j++) {
    //         // const r = Math.floor(Math.random() * 10) // TODO: * jub.order)

    //         const r = BigInt(hexlify(randomBytes(32)));
    //         const c = jub.mulPointEscalar(jub.Generator, r)
    //         a[i].push(r)
    //         C[i].push(c)
    //         edwards_twist_C[i].push([])
    //         edwards_twist_C[i][j].push(jub.F.toString(c[0]))
    //         edwards_twist_C[i][j].push(jub.F.toString(c[1]))
    //     }

    //     // submit C on-chain.
    //     // await (await nc.connect(commitee[i]).round1(edwards_twist_C[i])).wait()

    //     // PK_comp = jub.addPoint(PK_comp, C[i][0])
    // }

    // expect(jub.F.toString(PK[0])).equal(await nc.get_PK()[0])
    // console.log("round 1 done!")
    // return {
    //     a : a,
    //     C : C,
    //     edwards_twist_C : edwards_twist_C,
    //     PK : PK
    // }
}
