// SPDX-License-Identifier: GPL-3.0
/*
    Copyright 2021 0KIMS association.

    This file is generated with [snarkJS](https://github.com/iden3/snarkjs).

    snarkJS is a free software: you can redistribute it and/or modify it
    under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    snarkJS is distributed in the hope that it will be useful, but WITHOUT
    ANY WARRANTY; without even the implied warranty of MERCHANTABILITY
    or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public
    License for more details.

    You should have received a copy of the GNU General Public License
    along with snarkJS. If not, see <https://www.gnu.org/licenses/>.
*/


pragma solidity >=0.7.0 <0.9.0;

contract round2PlonkVerifier {
    
    uint32 constant n =   65536;
    uint16 constant nPublic =  12;
    uint16 constant nLagrange = 12;
    
    uint256 constant Qmx = 14892900494013320149522792029371313135707633623616817288304560133684598197815;
    uint256 constant Qmy = 18433855915436373615880517010435958748125307224151521429584573385502855478109;
    uint256 constant Qlx = 13214024001761529872776261086506001372623587686377046347340240151821737903160;
    uint256 constant Qly = 10666766779333139808139761890568560430720031953812256155802715529092453303267;
    uint256 constant Qrx = 4632373826979633772088123122840347794871861282378927253902192817783118696138;
    uint256 constant Qry = 4941252858330996958612157147016707396853677790441132338743161276769334099545;
    uint256 constant Qox = 13985375164018240433029639929935957517149378606420355687338515665462885142518;
    uint256 constant Qoy = 14120811317424328529240754262923592576932228404902547158564888072726485969771;
    uint256 constant Qcx = 4237001074200544529453409390377385876435522042924386796035672033940237749079;
    uint256 constant Qcy = 983590102329063347998683650270596100212851749742291218397171478950687455941;
    uint256 constant S1x = 19948759370116692621863140390564608420511144867043672687335300107410900092164;
    uint256 constant S1y = 6833691748170725489194528412564963473759635329289941914390032290332374940269;
    uint256 constant S2x = 13719840815620845082775550044852373246374405411012643799228948065735747369242;
    uint256 constant S2y = 1968987064845223173594063837611583881141201421511204749075259483109340101795;
    uint256 constant S3x = 12997934983097463537067536195071635353533054721096537243950928867559535125620;
    uint256 constant S3y = 1297727269050098851286445327039796276076223019207394158370628017079857291160;
    uint256 constant k1 = 2;
    uint256 constant k2 = 3;
    uint256 constant X2x1 = 7773157547881250265245536194230252827149035241353614947767580109911367509766;
    uint256 constant X2x2 = 6873493074118367850795653880101239804863401302000173715463789434559447087549;
    uint256 constant X2y1 = 8637908185494558631024516641744372862416964120828974398876007497154951091409;
    uint256 constant X2y2 = 8047529186618021094900592496785619348427627007841456763339212916682420028238;
    
    uint256 constant q = 21888242871839275222246405745257275088548364400416034343698204186575808495617;
    uint256 constant qf = 21888242871839275222246405745257275088696311157297823662689037894645226208583;
    uint256 constant w1 = 421743594562400382753388642386256516545992082196004333756405989743524594615;    
    
    uint256 constant G1x = 1;
    uint256 constant G1y = 2;
    uint256 constant G2x1 = 10857046999023057135944570762232829481370756359578518086990519993285655852781;
    uint256 constant G2x2 = 11559732032986387107991004021392285783925812861821192530917403151452391805634;
    uint256 constant G2y1 = 8495653923123431417604973247489272438418190587263600148770280649306958101930;
    uint256 constant G2y2 = 4082367875863433681332203403145435568316851327593401208105741076214120093531;
    uint16 constant pA = 32;
    uint16 constant pB = 96;
    uint16 constant pC = 160;
    uint16 constant pZ = 224;
    uint16 constant pT1 = 288;
    uint16 constant pT2 = 352;
    uint16 constant pT3 = 416;
    uint16 constant pWxi = 480;
    uint16 constant pWxiw = 544;
    uint16 constant pEval_a = 608;
    uint16 constant pEval_b = 640;
    uint16 constant pEval_c = 672;
    uint16 constant pEval_s1 = 704;
    uint16 constant pEval_s2 = 736;
    uint16 constant pEval_zw = 768;
    uint16 constant pEval_r = 800;
    
    uint16 constant pAlpha = 0;
    uint16 constant pBeta = 32;
    uint16 constant pGamma = 64;
    uint16 constant pXi = 96;
    uint16 constant pXin = 128;
    uint16 constant pBetaXi = 160;
    uint16 constant pV1 = 192;
    uint16 constant pV2 = 224;
    uint16 constant pV3 = 256;
    uint16 constant pV4 = 288;
    uint16 constant pV5 = 320;
    uint16 constant pV6 = 352;
    uint16 constant pU = 384;
    uint16 constant pPl = 416;
    uint16 constant pEval_t = 448;
    uint16 constant pA1 = 480;
    uint16 constant pB1 = 544;
    uint16 constant pZh = 608;
    uint16 constant pZhInv = 640;
    
    uint16 constant pEval_l1 = 672;
    
    uint16 constant pEval_l2 = 704;
    
    uint16 constant pEval_l3 = 736;
    
    uint16 constant pEval_l4 = 768;
    
    uint16 constant pEval_l5 = 800;
    
    uint16 constant pEval_l6 = 832;
    
    uint16 constant pEval_l7 = 864;
    
    uint16 constant pEval_l8 = 896;
    
    uint16 constant pEval_l9 = 928;
    
    uint16 constant pEval_l10 = 960;
    
    uint16 constant pEval_l11 = 992;
    
    uint16 constant pEval_l12 = 1024;
    
    
    
    uint16 constant lastMem = 1056;

    function verifyProof(bytes memory proof, uint[] memory pubSignals) public view returns (bool) {
        assembly {
            /////////
            // Computes the inverse using the extended euclidean algorithm
            /////////
            function inverse(a, q) -> inv {
                let t := 0     
                let newt := 1
                let r := q     
                let newr := a
                let quotient
                let aux
                
                for { } newr { } {
                    quotient := sdiv(r, newr)
                    aux := sub(t, mul(quotient, newt))
                    t:= newt
                    newt:= aux
                    
                    aux := sub(r,mul(quotient, newr))
                    r := newr
                    newr := aux
                }
                
                if gt(r, 1) { revert(0,0) }
                if slt(t, 0) { t:= add(t, q) }

                inv := t
            }
            
            ///////
            // Computes the inverse of an array of values
            // See https://vitalik.ca/general/2018/07/21/starks_part_3.html in section where explain fields operations
            //////
            function inverseArray(pVals, n) {
    
                let pAux := mload(0x40)     // Point to the next free position
                let pIn := pVals
                let lastPIn := add(pVals, mul(n, 32))  // Read n elemnts
                let acc := mload(pIn)       // Read the first element
                pIn := add(pIn, 32)         // Point to the second element
                let inv
    
                
                for { } lt(pIn, lastPIn) { 
                    pAux := add(pAux, 32) 
                    pIn := add(pIn, 32)
                } 
                {
                    mstore(pAux, acc)
                    acc := mulmod(acc, mload(pIn), q)
                }
                acc := inverse(acc, q)
                
                // At this point pAux pint to the next free position we substract 1 to point to the last used
                pAux := sub(pAux, 32)
                // pIn points to the n+1 element, we substract to point to n
                pIn := sub(pIn, 32)
                lastPIn := pVals  // We don't process the first element 
                for { } gt(pIn, lastPIn) { 
                    pAux := sub(pAux, 32) 
                    pIn := sub(pIn, 32)
                } 
                {
                    inv := mulmod(acc, mload(pAux), q)
                    acc := mulmod(acc, mload(pIn), q)
                    mstore(pIn, inv)
                }
                // pIn points to first element, we just set it.
                mstore(pIn, acc)
            }
            
            function checkField(v) {
                if iszero(lt(v, q)) {
                    mstore(0, 0)
                    return(0,0x20)
                }
            }
            
            function checkInput(pProof) {
                if iszero(eq(mload(pProof), 800 )) {
                    mstore(0, 0)
                    return(0,0x20)
                }
                checkField(mload(add(pProof, pEval_a)))
                checkField(mload(add(pProof, pEval_b)))
                checkField(mload(add(pProof, pEval_c)))
                checkField(mload(add(pProof, pEval_s1)))
                checkField(mload(add(pProof, pEval_s2)))
                checkField(mload(add(pProof, pEval_zw)))
                checkField(mload(add(pProof, pEval_r)))

                // Points are checked in the point operations precompiled smart contracts
            }
            
            function calculateChallanges(pProof, pMem, pPublic) {
            
                let a
                let b

                
                mstore( add(pMem, 1056 ), mload( add( pPublic, 32)))
                
                mstore( add(pMem, 1088 ), mload( add( pPublic, 64)))
                
                mstore( add(pMem, 1120 ), mload( add( pPublic, 96)))
                
                mstore( add(pMem, 1152 ), mload( add( pPublic, 128)))
                
                mstore( add(pMem, 1184 ), mload( add( pPublic, 160)))
                
                mstore( add(pMem, 1216 ), mload( add( pPublic, 192)))
                
                mstore( add(pMem, 1248 ), mload( add( pPublic, 224)))
                
                mstore( add(pMem, 1280 ), mload( add( pPublic, 256)))
                
                mstore( add(pMem, 1312 ), mload( add( pPublic, 288)))
                
                mstore( add(pMem, 1344 ), mload( add( pPublic, 320)))
                
                mstore( add(pMem, 1376 ), mload( add( pPublic, 352)))
                
                mstore( add(pMem, 1408 ), mload( add( pPublic, 384)))
                
                mstore( add(pMem, 1440 ), mload( add( pProof, pA)))
                mstore( add(pMem, 1472 ), mload( add( pProof, add(pA,32))))
                mstore( add(pMem, 1504 ), mload( add( pProof, add(pA,64))))
                mstore( add(pMem, 1536 ), mload( add( pProof, add(pA,96))))
                mstore( add(pMem, 1568 ), mload( add( pProof, add(pA,128))))
                mstore( add(pMem, 1600 ), mload( add( pProof, add(pA,160))))
                
                b := mod(keccak256(add(pMem, lastMem), 576), q) 
                mstore( add(pMem, pBeta), b)
                mstore( add(pMem, pGamma), mod(keccak256(add(pMem, pBeta), 32), q))
                mstore( add(pMem, pAlpha), mod(keccak256(add(pProof, pZ), 64), q))
                
                a := mod(keccak256(add(pProof, pT1), 192), q)
                mstore( add(pMem, pXi), a)
                mstore( add(pMem, pBetaXi), mulmod(b, a, q))
                
                a:= mulmod(a, a, q)
                
                a:= mulmod(a, a, q)
                
                a:= mulmod(a, a, q)
                
                a:= mulmod(a, a, q)
                
                a:= mulmod(a, a, q)
                
                a:= mulmod(a, a, q)
                
                a:= mulmod(a, a, q)
                
                a:= mulmod(a, a, q)
                
                a:= mulmod(a, a, q)
                
                a:= mulmod(a, a, q)
                
                a:= mulmod(a, a, q)
                
                a:= mulmod(a, a, q)
                
                a:= mulmod(a, a, q)
                
                a:= mulmod(a, a, q)
                
                a:= mulmod(a, a, q)
                
                a:= mulmod(a, a, q)
                
                mstore( add(pMem, pXin), a)
                a:= mod(add(sub(a, 1),q), q)
                mstore( add(pMem, pZh), a)
                mstore( add(pMem, pZhInv), a)  // We will invert later together with lagrange pols
                
                let v1 := mod(keccak256(add(pProof, pEval_a), 224), q)
                mstore( add(pMem, pV1), v1)
                a := mulmod(v1, v1, q)
                mstore( add(pMem, pV2), a)
                a := mulmod(a, v1, q)
                mstore( add(pMem, pV3), a)
                a := mulmod(a, v1, q)
                mstore( add(pMem, pV4), a)
                a := mulmod(a, v1, q)
                mstore( add(pMem, pV5), a)
                a := mulmod(a, v1, q)
                mstore( add(pMem, pV6), a)
                
                mstore( add(pMem, pU), mod(keccak256(add(pProof, pWxi), 128), q))
            }
            
            function calculateLagrange(pMem) {

                let w := 1                
                
                mstore(
                    add(pMem, pEval_l1), 
                    mulmod(
                        n, 
                        mod(
                            add(
                                sub(
                                    mload(add(pMem, pXi)), 
                                    w
                                ), 
                                q
                            ),
                            q
                        ), 
                        q
                    )
                )
                
                w := mulmod(w, w1, q)
                
                
                mstore(
                    add(pMem, pEval_l2), 
                    mulmod(
                        n, 
                        mod(
                            add(
                                sub(
                                    mload(add(pMem, pXi)), 
                                    w
                                ), 
                                q
                            ),
                            q
                        ), 
                        q
                    )
                )
                
                w := mulmod(w, w1, q)
                
                
                mstore(
                    add(pMem, pEval_l3), 
                    mulmod(
                        n, 
                        mod(
                            add(
                                sub(
                                    mload(add(pMem, pXi)), 
                                    w
                                ), 
                                q
                            ),
                            q
                        ), 
                        q
                    )
                )
                
                w := mulmod(w, w1, q)
                
                
                mstore(
                    add(pMem, pEval_l4), 
                    mulmod(
                        n, 
                        mod(
                            add(
                                sub(
                                    mload(add(pMem, pXi)), 
                                    w
                                ), 
                                q
                            ),
                            q
                        ), 
                        q
                    )
                )
                
                w := mulmod(w, w1, q)
                
                
                mstore(
                    add(pMem, pEval_l5), 
                    mulmod(
                        n, 
                        mod(
                            add(
                                sub(
                                    mload(add(pMem, pXi)), 
                                    w
                                ), 
                                q
                            ),
                            q
                        ), 
                        q
                    )
                )
                
                w := mulmod(w, w1, q)
                
                
                mstore(
                    add(pMem, pEval_l6), 
                    mulmod(
                        n, 
                        mod(
                            add(
                                sub(
                                    mload(add(pMem, pXi)), 
                                    w
                                ), 
                                q
                            ),
                            q
                        ), 
                        q
                    )
                )
                
                w := mulmod(w, w1, q)
                
                
                mstore(
                    add(pMem, pEval_l7), 
                    mulmod(
                        n, 
                        mod(
                            add(
                                sub(
                                    mload(add(pMem, pXi)), 
                                    w
                                ), 
                                q
                            ),
                            q
                        ), 
                        q
                    )
                )
                
                w := mulmod(w, w1, q)
                
                
                mstore(
                    add(pMem, pEval_l8), 
                    mulmod(
                        n, 
                        mod(
                            add(
                                sub(
                                    mload(add(pMem, pXi)), 
                                    w
                                ), 
                                q
                            ),
                            q
                        ), 
                        q
                    )
                )
                
                w := mulmod(w, w1, q)
                
                
                mstore(
                    add(pMem, pEval_l9), 
                    mulmod(
                        n, 
                        mod(
                            add(
                                sub(
                                    mload(add(pMem, pXi)), 
                                    w
                                ), 
                                q
                            ),
                            q
                        ), 
                        q
                    )
                )
                
                w := mulmod(w, w1, q)
                
                
                mstore(
                    add(pMem, pEval_l10), 
                    mulmod(
                        n, 
                        mod(
                            add(
                                sub(
                                    mload(add(pMem, pXi)), 
                                    w
                                ), 
                                q
                            ),
                            q
                        ), 
                        q
                    )
                )
                
                w := mulmod(w, w1, q)
                
                
                mstore(
                    add(pMem, pEval_l11), 
                    mulmod(
                        n, 
                        mod(
                            add(
                                sub(
                                    mload(add(pMem, pXi)), 
                                    w
                                ), 
                                q
                            ),
                            q
                        ), 
                        q
                    )
                )
                
                w := mulmod(w, w1, q)
                
                
                mstore(
                    add(pMem, pEval_l12), 
                    mulmod(
                        n, 
                        mod(
                            add(
                                sub(
                                    mload(add(pMem, pXi)), 
                                    w
                                ), 
                                q
                            ),
                            q
                        ), 
                        q
                    )
                )
                
                
                
                inverseArray(add(pMem, pZhInv), 13 )
                
                let zh := mload(add(pMem, pZh))
                w := 1
                
                
                mstore(
                    add(pMem, pEval_l1 ), 
                    mulmod(
                        mload(add(pMem, pEval_l1 )),
                        zh,
                        q
                    )
                )
                
                
                w := mulmod(w, w1, q)
                
                
                
                mstore(
                    add(pMem, pEval_l2), 
                    mulmod(
                        w,
                        mulmod(
                            mload(add(pMem, pEval_l2)),
                            zh,
                            q
                        ),
                        q
                    )
                )
                
                
                w := mulmod(w, w1, q)
                
                
                
                mstore(
                    add(pMem, pEval_l3), 
                    mulmod(
                        w,
                        mulmod(
                            mload(add(pMem, pEval_l3)),
                            zh,
                            q
                        ),
                        q
                    )
                )
                
                
                w := mulmod(w, w1, q)
                
                
                
                mstore(
                    add(pMem, pEval_l4), 
                    mulmod(
                        w,
                        mulmod(
                            mload(add(pMem, pEval_l4)),
                            zh,
                            q
                        ),
                        q
                    )
                )
                
                
                w := mulmod(w, w1, q)
                
                
                
                mstore(
                    add(pMem, pEval_l5), 
                    mulmod(
                        w,
                        mulmod(
                            mload(add(pMem, pEval_l5)),
                            zh,
                            q
                        ),
                        q
                    )
                )
                
                
                w := mulmod(w, w1, q)
                
                
                
                mstore(
                    add(pMem, pEval_l6), 
                    mulmod(
                        w,
                        mulmod(
                            mload(add(pMem, pEval_l6)),
                            zh,
                            q
                        ),
                        q
                    )
                )
                
                
                w := mulmod(w, w1, q)
                
                
                
                mstore(
                    add(pMem, pEval_l7), 
                    mulmod(
                        w,
                        mulmod(
                            mload(add(pMem, pEval_l7)),
                            zh,
                            q
                        ),
                        q
                    )
                )
                
                
                w := mulmod(w, w1, q)
                
                
                
                mstore(
                    add(pMem, pEval_l8), 
                    mulmod(
                        w,
                        mulmod(
                            mload(add(pMem, pEval_l8)),
                            zh,
                            q
                        ),
                        q
                    )
                )
                
                
                w := mulmod(w, w1, q)
                
                
                
                mstore(
                    add(pMem, pEval_l9), 
                    mulmod(
                        w,
                        mulmod(
                            mload(add(pMem, pEval_l9)),
                            zh,
                            q
                        ),
                        q
                    )
                )
                
                
                w := mulmod(w, w1, q)
                
                
                
                mstore(
                    add(pMem, pEval_l10), 
                    mulmod(
                        w,
                        mulmod(
                            mload(add(pMem, pEval_l10)),
                            zh,
                            q
                        ),
                        q
                    )
                )
                
                
                w := mulmod(w, w1, q)
                
                
                
                mstore(
                    add(pMem, pEval_l11), 
                    mulmod(
                        w,
                        mulmod(
                            mload(add(pMem, pEval_l11)),
                            zh,
                            q
                        ),
                        q
                    )
                )
                
                
                w := mulmod(w, w1, q)
                
                
                
                mstore(
                    add(pMem, pEval_l12), 
                    mulmod(
                        w,
                        mulmod(
                            mload(add(pMem, pEval_l12)),
                            zh,
                            q
                        ),
                        q
                    )
                )
                
                
                


            }
            
            function calculatePl(pMem, pPub) {
                let pl := 0
                
                 
                pl := mod(
                    add(
                        sub(
                            pl,  
                            mulmod(
                                mload(add(pMem, pEval_l1)),
                                mload(add(pPub, 32)),
                                q
                            )
                        ),
                        q
                    ),
                    q
                )
                 
                pl := mod(
                    add(
                        sub(
                            pl,  
                            mulmod(
                                mload(add(pMem, pEval_l2)),
                                mload(add(pPub, 64)),
                                q
                            )
                        ),
                        q
                    ),
                    q
                )
                 
                pl := mod(
                    add(
                        sub(
                            pl,  
                            mulmod(
                                mload(add(pMem, pEval_l3)),
                                mload(add(pPub, 96)),
                                q
                            )
                        ),
                        q
                    ),
                    q
                )
                 
                pl := mod(
                    add(
                        sub(
                            pl,  
                            mulmod(
                                mload(add(pMem, pEval_l4)),
                                mload(add(pPub, 128)),
                                q
                            )
                        ),
                        q
                    ),
                    q
                )
                 
                pl := mod(
                    add(
                        sub(
                            pl,  
                            mulmod(
                                mload(add(pMem, pEval_l5)),
                                mload(add(pPub, 160)),
                                q
                            )
                        ),
                        q
                    ),
                    q
                )
                 
                pl := mod(
                    add(
                        sub(
                            pl,  
                            mulmod(
                                mload(add(pMem, pEval_l6)),
                                mload(add(pPub, 192)),
                                q
                            )
                        ),
                        q
                    ),
                    q
                )
                 
                pl := mod(
                    add(
                        sub(
                            pl,  
                            mulmod(
                                mload(add(pMem, pEval_l7)),
                                mload(add(pPub, 224)),
                                q
                            )
                        ),
                        q
                    ),
                    q
                )
                 
                pl := mod(
                    add(
                        sub(
                            pl,  
                            mulmod(
                                mload(add(pMem, pEval_l8)),
                                mload(add(pPub, 256)),
                                q
                            )
                        ),
                        q
                    ),
                    q
                )
                 
                pl := mod(
                    add(
                        sub(
                            pl,  
                            mulmod(
                                mload(add(pMem, pEval_l9)),
                                mload(add(pPub, 288)),
                                q
                            )
                        ),
                        q
                    ),
                    q
                )
                 
                pl := mod(
                    add(
                        sub(
                            pl,  
                            mulmod(
                                mload(add(pMem, pEval_l10)),
                                mload(add(pPub, 320)),
                                q
                            )
                        ),
                        q
                    ),
                    q
                )
                 
                pl := mod(
                    add(
                        sub(
                            pl,  
                            mulmod(
                                mload(add(pMem, pEval_l11)),
                                mload(add(pPub, 352)),
                                q
                            )
                        ),
                        q
                    ),
                    q
                )
                 
                pl := mod(
                    add(
                        sub(
                            pl,  
                            mulmod(
                                mload(add(pMem, pEval_l12)),
                                mload(add(pPub, 384)),
                                q
                            )
                        ),
                        q
                    ),
                    q
                )
                
                
                mstore(add(pMem, pPl), pl)
                

            }

            function calculateT(pProof, pMem) {
                let t
                let t1
                let t2
                t := addmod(
                    mload(add(pProof, pEval_r)), 
                    mload(add(pMem, pPl)), 
                    q
                )
                
                t1 := mulmod(
                    mload(add(pProof, pEval_s1)),
                    mload(add(pMem, pBeta)),
                    q
                )

                t1 := addmod(
                    t1,
                    mload(add(pProof, pEval_a)),
                    q
                )
                
                t1 := addmod(
                    t1,
                    mload(add(pMem, pGamma)),
                    q
                )

                t2 := mulmod(
                    mload(add(pProof, pEval_s2)),
                    mload(add(pMem, pBeta)),
                    q
                )

                t2 := addmod(
                    t2,
                    mload(add(pProof, pEval_b)),
                    q
                )
                
                t2 := addmod(
                    t2,
                    mload(add(pMem, pGamma)),
                    q
                )
                
                t1 := mulmod(t1, t2, q)
                
                t2 := addmod(
                    mload(add(pProof, pEval_c)),
                    mload(add(pMem, pGamma)),
                    q
                )

                t1 := mulmod(t1, t2, q)
                t1 := mulmod(t1, mload(add(pProof, pEval_zw)), q)
                t1 := mulmod(t1, mload(add(pMem, pAlpha)), q)
                
                t2 := mulmod(
                    mload(add(pMem, pEval_l1)), 
                    mload(add(pMem, pAlpha)), 
                    q
                )

                t2 := mulmod(
                    t2, 
                    mload(add(pMem, pAlpha)), 
                    q
                )

                t1 := addmod(t1, t2, q)
                
                t := mod(sub(add(t, q), t1), q)
                t := mulmod(t, mload(add(pMem, pZhInv)), q)
                
                mstore( add(pMem, pEval_t) , t)

            }
            
            function g1_set(pR, pP) {
                mstore(pR, mload(pP))
                mstore(add(pR, 32), mload(add(pP,32)))
            }

            function g1_acc(pR, pP) {
                let mIn := mload(0x40)
                mstore(mIn, mload(pR))
                mstore(add(mIn,32), mload(add(pR, 32)))
                mstore(add(mIn,64), mload(pP))
                mstore(add(mIn,96), mload(add(pP, 32)))

                let success := staticcall(sub(gas(), 2000), 6, mIn, 128, pR, 64)
                
                if iszero(success) {
                    mstore(0, 0)
                    return(0,0x20)
                }
            }

            function g1_mulAcc(pR, pP, s) {
                let success
                let mIn := mload(0x40)
                mstore(mIn, mload(pP))
                mstore(add(mIn,32), mload(add(pP, 32)))
                mstore(add(mIn,64), s)

                success := staticcall(sub(gas(), 2000), 7, mIn, 96, mIn, 64)
                
                if iszero(success) {
                    mstore(0, 0)
                    return(0,0x20)
                }
                
                mstore(add(mIn,64), mload(pR))
                mstore(add(mIn,96), mload(add(pR, 32)))

                success := staticcall(sub(gas(), 2000), 6, mIn, 128, pR, 64)
                
                if iszero(success) {
                    mstore(0, 0)
                    return(0,0x20)
                }
                
            }

            function g1_mulAccC(pR, x, y, s) {
                let success
                let mIn := mload(0x40)
                mstore(mIn, x)
                mstore(add(mIn,32), y)
                mstore(add(mIn,64), s)

                success := staticcall(sub(gas(), 2000), 7, mIn, 96, mIn, 64)
                
                if iszero(success) {
                    mstore(0, 0)
                    return(0,0x20)
                }
                
                mstore(add(mIn,64), mload(pR))
                mstore(add(mIn,96), mload(add(pR, 32)))

                success := staticcall(sub(gas(), 2000), 6, mIn, 128, pR, 64)
                
                if iszero(success) {
                    mstore(0, 0)
                    return(0,0x20)
                }
            }

            function g1_mulSetC(pR, x, y, s) {
                let success
                let mIn := mload(0x40)
                mstore(mIn, x)
                mstore(add(mIn,32), y)
                mstore(add(mIn,64), s)

                success := staticcall(sub(gas(), 2000), 7, mIn, 96, pR, 64)
                
                if iszero(success) {
                    mstore(0, 0)
                    return(0,0x20)
                }
            }


            function calculateA1(pProof, pMem) {
                let p := add(pMem, pA1)
                g1_set(p, add(pProof, pWxi))
                g1_mulAcc(p, add(pProof, pWxiw), mload(add(pMem, pU)))
            }
            
            
            function calculateB1(pProof, pMem) {
                let s
                let s1
                let p := add(pMem, pB1)
                
                // Calculate D
                s := mulmod( mload(add(pProof, pEval_a)), mload(add(pMem, pV1)), q)
                g1_mulSetC(p, Qlx, Qly, s)

                s := mulmod( s, mload(add(pProof, pEval_b)), q)                
                g1_mulAccC(p, Qmx, Qmy, s)

                s := mulmod( mload(add(pProof, pEval_b)), mload(add(pMem, pV1)), q)
                g1_mulAccC(p, Qrx, Qry, s)
                
                s := mulmod( mload(add(pProof, pEval_c)), mload(add(pMem, pV1)), q)
                g1_mulAccC(p, Qox, Qoy, s)

                s :=mload(add(pMem, pV1))
                g1_mulAccC(p, Qcx, Qcy, s)

                s := addmod(mload(add(pProof, pEval_a)), mload(add(pMem, pBetaXi)), q)
                s := addmod(s, mload(add(pMem, pGamma)), q)
                s1 := mulmod(k1, mload(add(pMem, pBetaXi)), q)
                s1 := addmod(s1, mload(add(pProof, pEval_b)), q)
                s1 := addmod(s1, mload(add(pMem, pGamma)), q)
                s := mulmod(s, s1, q)
                s1 := mulmod(k2, mload(add(pMem, pBetaXi)), q)
                s1 := addmod(s1, mload(add(pProof, pEval_c)), q)
                s1 := addmod(s1, mload(add(pMem, pGamma)), q)
                s := mulmod(s, s1, q)
                s := mulmod(s, mload(add(pMem, pAlpha)), q)
                s := mulmod(s, mload(add(pMem, pV1)), q)
                s1 := mulmod(mload(add(pMem, pEval_l1)), mload(add(pMem, pAlpha)), q)
                s1 := mulmod(s1, mload(add(pMem, pAlpha)), q)
                s1 := mulmod(s1, mload(add(pMem, pV1)), q)
                s := addmod(s, s1, q)
                s := addmod(s, mload(add(pMem, pU)), q)
                g1_mulAcc(p, add(pProof, pZ), s)
                
                s := mulmod(mload(add(pMem, pBeta)), mload(add(pProof, pEval_s1)), q)
                s := addmod(s, mload(add(pProof, pEval_a)), q)
                s := addmod(s, mload(add(pMem, pGamma)), q)
                s1 := mulmod(mload(add(pMem, pBeta)), mload(add(pProof, pEval_s2)), q)
                s1 := addmod(s1, mload(add(pProof, pEval_b)), q)
                s1 := addmod(s1, mload(add(pMem, pGamma)), q)
                s := mulmod(s, s1, q)
                s := mulmod(s, mload(add(pMem, pAlpha)), q)
                s := mulmod(s, mload(add(pMem, pV1)), q)
                s := mulmod(s, mload(add(pMem, pBeta)), q)
                s := mulmod(s, mload(add(pProof, pEval_zw)), q)
                s := mod(sub(q, s), q)
                g1_mulAccC(p, S3x, S3y, s)


                // calculate F
                g1_acc(p , add(pProof, pT1))

                s := mload(add(pMem, pXin))
                g1_mulAcc(p, add(pProof, pT2), s)
                
                s := mulmod(s, s, q)
                g1_mulAcc(p, add(pProof, pT3), s)
                
                g1_mulAcc(p, add(pProof, pA), mload(add(pMem, pV2)))
                g1_mulAcc(p, add(pProof, pB), mload(add(pMem, pV3)))
                g1_mulAcc(p, add(pProof, pC), mload(add(pMem, pV4)))
                g1_mulAccC(p, S1x, S1y, mload(add(pMem, pV5)))
                g1_mulAccC(p, S2x, S2y, mload(add(pMem, pV6)))
                
                // calculate E
                s := mload(add(pMem, pEval_t))
                s := addmod(s, mulmod(mload(add(pProof, pEval_r)), mload(add(pMem, pV1)), q), q)
                s := addmod(s, mulmod(mload(add(pProof, pEval_a)), mload(add(pMem, pV2)), q), q)
                s := addmod(s, mulmod(mload(add(pProof, pEval_b)), mload(add(pMem, pV3)), q), q)
                s := addmod(s, mulmod(mload(add(pProof, pEval_c)), mload(add(pMem, pV4)), q), q)
                s := addmod(s, mulmod(mload(add(pProof, pEval_s1)), mload(add(pMem, pV5)), q), q)
                s := addmod(s, mulmod(mload(add(pProof, pEval_s2)), mload(add(pMem, pV6)), q), q)
                s := addmod(s, mulmod(mload(add(pProof, pEval_zw)), mload(add(pMem, pU)), q), q)
                s := mod(sub(q, s), q)
                g1_mulAccC(p, G1x, G1y, s)
                
                
                // Last part of B
                s := mload(add(pMem, pXi))
                g1_mulAcc(p, add(pProof, pWxi), s)

                s := mulmod(mload(add(pMem, pU)), mload(add(pMem, pXi)), q)
                s := mulmod(s, w1, q)
                g1_mulAcc(p, add(pProof, pWxiw), s)

            }
            
            function checkPairing(pMem) -> isOk {
                let mIn := mload(0x40)
                mstore(mIn, mload(add(pMem, pA1)))
                mstore(add(mIn,32), mload(add(add(pMem, pA1), 32)))
                mstore(add(mIn,64), X2x2)
                mstore(add(mIn,96), X2x1)
                mstore(add(mIn,128), X2y2)
                mstore(add(mIn,160), X2y1)
                mstore(add(mIn,192), mload(add(pMem, pB1)))
                let s := mload(add(add(pMem, pB1), 32))
                s := mod(sub(qf, s), qf)
                mstore(add(mIn,224), s)
                mstore(add(mIn,256), G2x2)
                mstore(add(mIn,288), G2x1)
                mstore(add(mIn,320), G2y2)
                mstore(add(mIn,352), G2y1)
                
                let success := staticcall(sub(gas(), 2000), 8, mIn, 384, mIn, 0x20)
                
                isOk := and(success, mload(mIn))
            }
            
            let pMem := mload(0x40)
            mstore(0x40, add(pMem, lastMem))
            
            checkInput(proof)
            calculateChallanges(proof, pMem, pubSignals)
            calculateLagrange(pMem)
            calculatePl(pMem, pubSignals)
            calculateT(proof, pMem)
            calculateA1(proof, pMem)
            calculateB1(proof, pMem)
            let isValid := checkPairing(pMem)
            
            mstore(0x40, sub(pMem, lastMem))
            mstore(0, isValid)
            return(0,0x20)
        }
        
    }
}
