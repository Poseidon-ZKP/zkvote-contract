import { exit } from "process";

const { buildBabyjub } = require('circomlibjs');

// node_modules/circomlibjs/src/babyjub.js

async function jub_test() {
    const jub = await buildBabyjub()
    console.log("jub : ", jub)
    return jub
}

async function main(
) {
    const jub = await jub_test()
    // exit(0)

    const V = [1, 2, 3, 4, 5]        // voting power per user

    // 1. Key Generation (Committee)
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


    const PK = 1                     // sk * G
    const n_user = V.length


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

