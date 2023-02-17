Impl the idea in https://hackmd.io/6ZFxxxnKT0iH-GJHUxKekw

# Estimation

A quick draft estimation on ZKP constraints and Gas Cost, Pls check whether it make sense to you.

Suppose n_com = 21, t = 10, and jubjub scalar_mul = ~1000

1. Round 2 have a larger but luckily 1-time constraints.
2. Pretty smaller ZKP for user voting.
3. Will profile posedion_enc later, guess affect less for Round 2.
4. ～20W fixed growth16 verification gas, 6K extra for each public input.
5. The estimation don't include basic circuit overhead(~6K) and contract decrypt/reveal logic cost.

|Stage| mul/xor/exp.| Scalar mul(jubjub). | posedion hash | Constraints | Public Input | Verify Gas |
| --- | ---- | --- | ---- | --- | --- | --- |
|  Round1|                 |    t   |              | 10 K| 2t | 320K |
|  Round2 | (n_com-1)*t | (n_com-1)*t|(n_com-1)*4  |200K+           | 2t+1 | 326K |
|  Voting  |                 |    5   |              |  5K | 10 |260K|
|  Tally   |                 |    1   |              | 1K | 4 |224K|

# Profile


# Refine Tips

1. no need ZKP in Round 1?

ZKP(Round 1) only prove "the C points is on jubjub curve", which seems also been proved in Round 2

Can be replaced by onchain "isOnCurve" instead.

2. Also have Same concern for the  tally ZKP

suppose if 1 committee give wrong Di, there is no way to identify, and  reveal fail. 

3. why Enc ? when Decrypt ?  using poseidon or EI-Gamma

if no decrypt, just 1 poseidon hash ?


# Reference

1. [Baby Jubjub Library(Circom/js/sol)](https://eips.ethereum.org/EIPS/eip-2494)