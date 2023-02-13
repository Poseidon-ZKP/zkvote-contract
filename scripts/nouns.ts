import { exit } from "process";

const { PublicKey, PrivateKey, Jub } = require('babyjubjub');


async function jub_test() {
    let sk = PrivateKey.getRandObj().field;
    console.log("sk : ", sk.n)
    let privKey = new PrivateKey(sk);
    console.log("privKey : ", privKey)
    let pubKey = PublicKey.fromPrivate(privKey)
    console.log("pubKey : ", pubKey.p)

    let message = ["97","98","99"];
    let random = "12314121";
    let cipher = Jub.encrypt(message, pubKey, random);
    console.log("encrypt : ", cipher);
    let decrypted = Jub.decrypt(cipher, sk);
    console.log("decrypted : ", decrypted);
    exit(0)
}

async function main(
) {
    await jub_test()

    const V = [1, 2, 3, 4, 5]        // voting power per user

    // 1. Key Generation (Committee)
    const N_COM = 3
    const t = 2
    let a = []
    let C = []
    for (let i = 0; i < N_COM; i++) {
        a.push([])
        C.push([])
        for (let j = 0; j < t; j++) {
            const sk = PrivateKey.getRandObj().field
            const pk = PublicKey.importPrivate(sk)
            a[i].push(sk)
            C[i].push(pk)
        }
    }

    // proof(C) : jubjub circom circuit
    // node_modules/circomlib/circuits/babyjub.circom
    // TODO :
    // 1. node_modules/babyjubjub/lib/Point.js , using same generator as circom


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

