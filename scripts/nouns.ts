import { exit } from "process";

const { buildBabyjub } = require('circomlibjs');
const polyval = require( 'compute-polynomial' );

async function jub_test() {
    const jub = await buildBabyjub()
    console.log("jub : ", jub)
    return jub
}

async function main(
) {
    // var vals = polyval( [ 4, 2, 6, -17 ], [ 10, -3 ] )
    // console.log("vals : ", vals)
    const jub = await jub_test()

    const V = [1, 2, 3, 4, 5]        // voting power per user
    const N_USER = V.length

    // 1. Key Generation Round 1 (Committee)
    const N_COM = 3
    const t = 2
    let a = []  // [][]
    let C = []  // [][][2]
    for (let i = 0; i < N_COM; i++) {
        a.push([])
        C.push([])
        for (let j = 0; j < t; j++) {
            const sk = Math.floor(Math.random() * 10000) // TODO: * jub.order)
            const pk = jub.mulPointEscalar(jub.Generator, sk)
            a[i].push(sk)
            C[i].push(pk)
        }
    }

    // generate zkp(C), on-chain


    // 2. Key Generation Round 2 (Committee)

    for (let i = 0; i < N_USER; i++) {
        // fi(x)
    }



    const PK = 1                     // sk * G


    // Private Input
    const o = [0b100 /* yes */, 0b010 /* no */, 0b001 /* abstain */, 0b100, 0b010]
    const r = [1, 2, 3, 4, 5]        // random Fr per user

    // Public Input
    const R = []                     // r*G
    const M = [                      
        []                           // M[i][k] = (o[i][k] * V[i]) * G + r[i] * PK
    ]


    // 2. User's ZKP
    const D = []

    // 3. Committe's ZKP


    // Performance Profile
}


main()
.then(() => process.exit(0))
.catch(error => {
  console.error(error);
  process.exit(1);
});

