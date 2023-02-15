const { buildBabyjub } = require('circomlibjs');
const polyval = require( 'compute-polynomial' );

async function jub_test() {
    const jub = await buildBabyjub()
    console.log("jub : ", jub)
    return jub
}

async function main(
) {
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
            const r = Math.floor(Math.random() * 10000) // TODO: * jub.order)
            const c = jub.mulPointEscalar(jub.Generator, r)
            a[i].push(r)
            C[i].push(c)
        }
    }

    // generate zkp(C), on-chain


    // 2. Key Generation Round 2 (Committee)
    let f = []
    for (let i = 0; i < N_COM; i++) {
        f.push([])

        for (let l = 0; l < N_COM; l++) {
          f[i].push(polyval(a[i].reverse(), l))
        }
    }

    let sk = []
    for (let i = 0; i < N_COM; i++) {
        sk.push(0)
        for (let l = 0; l < N_COM; l++) {
            sk[i] += f[l][i]
        }
    }

    let PK = jub.Base8  // TODO : ZERO Point
    for (let i = 0; i < N_COM; i++) {
        PK = jub.addPoint(PK, C[i][0])
    }


    // Posideon Encrypt : why encrypt? when decrypt?
    // P xor P = 0 --> M = P xor P + M ?
    
    // ZKP for ... and Posideon Encrypt


    // 3. User Voting
    let o = []
    let r = []        // random Fr per user
    let R = []
    let R_SUM = jub.Base8
    let M = []
    for (let i = 0; i < N_USER; i++) {
        r.push(Math.floor(Math.random() * 10000)) // TODO: * jub.order)
        R.push(jub.mulPointEscalar(jub.Generator, r))
        R_SUM = jub.addPoint(R_SUM, R[i])

        const m = jub.mulPointEscalar(PK, r[i])
        const vm = jub.addPoint(m, jub.mulPointEscalar(jub.Generator, V[i]))

        if (i % 3 == 0) {
          o.push(0b100)  // yes
          M.push([m, m, vm]);
        } else if (i % 3 == 1) {
          o.push(0b010)  // no
          M.push([m, vm, m]);
        } else {
          o.push(0b001)  // abstain
          M.push([m, m, vm]);
        }
    }

    // 4. Tally
    const D = []
    for (let i = 0; i < N_COM; i++) {
        D.push(jub.mulPointEscalar(R_SUM, sk[i]))
    }


    // 5. Reveal


    // Performance Profile
}


main()
.then(() => process.exit(0))
.catch(error => {
  console.error(error);
  process.exit(1);
});

