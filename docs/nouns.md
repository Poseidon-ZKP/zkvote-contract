Impl the idea in https://hackmd.io/6ZFxxxnKT0iH-GJHUxKekw

# Estimation

A quick draft estimation on ZKP constraints and Gas Cost, Pls check whether it make sense to you.

Suppose n_com = 21, t = 10, and jubjub scalar_mul = ~1000

1. Round 2 have a larger but luckily 1-time constraints.
2. Pretty smaller ZKP for user voting.
3. Will profile posedion_enc later, guess affect less for Round 2.
4. ～20W fixed growth16 verification gas, 6K extra for each public input.
5. The estimation don't include basic circuit overhead(~6K) and contract decrypt/reveal logic cost.

|Stage| add/mul/exp.| Scalar mul(jubjub). | posedion enc | Constraints | Public Input | Verify Gas |
| --- | ---- | --- | ---- | --- | --- | --- |
|  Round1|                 |    t   |              | 10 K| 2t | 32w |
|  Round2 | (n_com - 1)*t | (n_com - 1)*t|n_com - 1  |200K+           | 2t+1 | 32.6w |
|  Voting  |                 |    5   |              |  5K | 10 |26w |
|  Tally   |                 |    1   |              | 1K | 4 |22.4w|

