import '@typechain/hardhat'
import "@nomiclabs/hardhat-waffle"
import "@nomiclabs/hardhat-ethers";
import "@openzeppelin/hardhat-upgrades"
import "hardhat-docgen"
import '@nomiclabs/hardhat-etherscan'
import "hardhat-contract-sizer"

require('dotenv').config()

import { extendConfig, task, subtask } from "hardhat/config";
task("accounts", "Prints the list of accounts", async (taskArgs, hre) => {
  const accounts = await hre.ethers.getSigners();
  const provider = hre.ethers.provider;

  console.log(accounts[0])

  // for (const account of accounts) {
  //     console.log(
  //         "%s (%i ETH)",
  //         account.address,
  //         hre.ethers.utils.formatEther(
  //             // getBalance returns wei amount, format to ETH amount
  //             await provider.getBalance(account.address)
  //         )
  //     );
  // }
});

const customAccounts = [
    `0x828a065aa2818619cb9a5435ce9e7d95fdd3e6dd89fc5fcd4dd4a37346a54084`, // 0x7A7765Db4733DFe037342A8bCDfAEE83ddE405da
    `0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d`, // 0x70997970c51812dc3a010c7d01b50e0d17dc79c8
    `0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a`, // 0x3c44cdddb6a900fa2b585dd299e03d12fa4293bc
    `0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80`,
    `0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6`,
    `0x47e179ec197488593b187f80a00eb0da91f1b9d0b13f8733639f19c30a34926a`,
    `0x8b3a350cf5c34c9194ca85829a2df0ec3153be0318b5e2d3348e872092edffba`,
    `0x92db14e403b83dfe3df233f83dfa3a0d7096f21ca9b0d6d6b8d88b2b4ec1564e`,
    `0x4bbbf85ce3377467afe5d46f804f221813b2bb87f24d81f60f1fcdbf7cbf4356`,
    `0xdbda1821b80551c9d65939329250298aa3472ba22feea921c0cf5d620ea67b97`,
    `0x2a871d0798f97d79848a013d4936a73bf4cc922c825d33c1cf7073dff6d409c6`,
    `0xf214f2b2cd398c806f84e317254e0f0b801d0643303237d97a22a48e01628897`,
    `0x701b615bbdfb9de65240bc28bd21bbc0d996645a3dd57e7b12bc2bdf6f192c82`,
    `0xa267530f49f8280200edf313ee7af6b827f2a8bce2897751d06a843f644967b1`,
    `0x47c99abed3324a2707c28affff1267e45918ec8c3f20b8aa892e8b065d2942dd`,
    `0xc526ee95bf44d8fc405a158bb884d9d1238d99f0612e9f33d006bb0789009aaa`,
    `0x8166f546bab6da521a8369cab06c5d2b9e46670292d85c875ee9ec20e84ffb61`,
    `0xea6c44ac03bff858b476bba40716402b03e41b8e97e276d1baec7c37d42484a0`,
    `0x689af8efa8c651a91ad287602527f3af2fe9f6501a7ac4b061667b5a93e037fd`,
    `0xde9be858da4a475276426320d5e9262ecfc3ba460bfac56360bfa6c4c28b4ee0`,
    `0xdf57089febbacf7ba0bc227dafbffa9fc08a93fdc68e1e42411a14efcf23656e`,
]

let hardhatAccounts = []
customAccounts.forEach(a => {
    hardhatAccounts.push(
        {
            privateKey : a,
            balance : "10000000000000000000000"
        }
  )
});


/**
 * @type import('hardhat/config').HardhatUserConfig
 */
module.exports = {
  solidity: {
    compilers : [
      {
        version: '0.8.12',
        settings: {
            optimizer: {
                enabled: true,
                runs: 200
            }
        }
      }, 
      {
        version: '0.8.4'
      },
      {
        version: '0.5.16'
      }
    ]
  },
  typechain: {
    outDir: 'scripts/types',
    target: 'ethers-v5',
    alwaysGenerateOverloads: false, // should overloads with full signatures like deposit(uint256) be generated always, even if there are no overloads?
    externalArtifacts: ['externalArtifacts/*.json'], // optional array of glob patterns with external artifacts to process (for example external libs from node_modules)
    dontOverrideCompile: false // defaults to false
  },
  networks: {
    localhost: {
      accounts: customAccounts
    },
    hardhat: {
      accounts: hardhatAccounts,
    },

    l1: {
      url: "http://127.0.0.1:9545",
      accounts: customAccounts
    },

    l2: {
      url: "http://127.0.0.1:8545",
      accounts: customAccounts
    },

    opGoerli: {
      //url: "https://goerli.optimism.io",
      url : "https://opt-goerli.g.alchemy.com/v2/FR5hJ_14k0N8hhJqnVNM803ymNsq5pOA",
      accounts: customAccounts
    },

    consesusZkevmGoerli: {
      url : "https://consensys-zkevm-goerli-prealpha.infura.io/v3/6de9e23229fe4a94a92882cd734306c4",
      accounts: customAccounts
    },

    rinkeby: {
      gasPrice : `auto`,
      gas : 6000000,
      url: `https://eth-rinkeby.alchemyapi.io/v2/ZmcigLlVI7dckhbxFSTmg5LOuC1rjUbw`,
      accounts: customAccounts
    }
  },
  etherscan: {
    // https://hardhat.org/plugins/nomiclabs-hardhat-etherscan.html
    // npx hardhat verify --network mainnet DEPLOYED_CONTRACT_ADDRESS "Constructor argument 1"
    //apiKey: "PET6CJHW44RUBYAJ97MKMKTXS7JCWKS2B2"
    apiKey: "Y5UPE2DNZ3YN14XTDEC6D9H84XJMK7QX77"
  },
  mocha: {
    // retries : 2,
    //timeout : 600000
  },

  contractSizer: {
    runOnCompile: true
  },
};
