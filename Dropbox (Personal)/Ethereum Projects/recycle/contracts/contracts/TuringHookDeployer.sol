// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Hooks} from "./interfaces/uniswap-v4/Hooks.sol";
import "./TuringHook.sol";

/**
 * @title TuringHookDeployer
 * @notice Deploys TuringHook with CREATE2 to get an address with correct V4 permission flags
 * @dev V4 requires hook addresses to have specific bits set based on permissions.
 *      This contract mines the correct salt to produce a valid hook address.
 *
 *      Mainnet V4 PoolManager (0x000000000004444c5dc75cB358380D2e3dE08A90) bit layout:
 *        Bit 13: beforeInitialize       Bit 7: beforeSwap           Bit 3: beforeSwapReturnDelta
 *        Bit 12: afterInitialize        Bit 6: afterSwap            Bit 2: afterSwapReturnDelta
 *        Bit 11: beforeAddLiquidity     Bit 5: beforeDonate         Bit 1: afterAddLiqReturnDelta
 *        Bit 10: afterAddLiquidity      Bit 4: afterDonate          Bit 0: afterRemLiqReturnDelta
 *        Bit  9: beforeRemoveLiquidity
 *        Bit  8: afterRemoveLiquidity
 *
 *      TuringHook needs: beforeSwap (7) + afterSwap (6) + afterSwapReturnDelta (2) = 0xC4
 */
contract TuringHookDeployer {
    uint160 private constant PERMISSION_BITS_MASK = (1 << 14) - 1; // lower 14 bits encode permissions
    uint160 private constant REQUIRED_FLAGS = (1 << 7) | (1 << 6) | (1 << 2); // 0xC4

    error InvalidHookFlags(uint160 flags);

    event HookDeployed(address indexed hook, bytes32 salt, uint160 flags);

    /**
     * @notice Deploy TuringHook with correct address flags
     * @param poolManager V4 PoolManager address
     * @param turingToken TURING token address
     * @param salt Salt for CREATE2 (must produce address with correct flags)
     * @return hook The deployed hook address
     * @dev Owner is set to msg.sender (the EOA calling this deployer),
     *      NOT the deployer contract itself. This fixes the ownership bug.
     */
    function deployHook(
        address poolManager,
        address turingToken,
        bytes32 salt
    ) external returns (address hook) {
        // Deploy with CREATE2 — pass msg.sender as owner so EOA owns the hook
        TuringHook newHook = new TuringHook{salt: salt}(
            IPoolManager(poolManager),
            turingToken,
            msg.sender
        );

        hook = address(newHook);

        // Verify address has correct flags (exact match — no extra bits set)
        uint160 hookFlags = uint160(hook) & PERMISSION_BITS_MASK;
        if (hookFlags != REQUIRED_FLAGS) {
            revert InvalidHookFlags(hookFlags);
        }

        emit HookDeployed(hook, salt, hookFlags);

        return hook;
    }

    /**
     * @notice Calculate CREATE2 address for given salt
     * @param poolManager V4 PoolManager address
     * @param turingToken TURING token address
     * @param owner Owner address passed to TuringHook constructor
     * @param salt Salt for CREATE2
     * @return predicted The predicted address
     */
    function predictHookAddress(
        address poolManager,
        address turingToken,
        address owner,
        bytes32 salt
    ) external view returns (address predicted) {
        bytes32 bytecodeHash = keccak256(
            abi.encodePacked(
                type(TuringHook).creationCode,
                abi.encode(poolManager, turingToken, owner)
            )
        );

        predicted = address(
            uint160(uint256(keccak256(abi.encodePacked(bytes1(0xff), address(this), salt, bytecodeHash))))
        );

        return predicted;
    }

    /**
     * @notice Check if an address has correct V4 hook flags
     * @param hookAddress Address to check
     * @return valid Whether the address has valid flags for our permissions
     */
    function validateHookAddress(address hookAddress) external pure returns (bool valid) {
        uint160 addr = uint160(hookAddress);
        uint160 flags = addr & PERMISSION_BITS_MASK;
        return flags == REQUIRED_FLAGS;
    }

    /**
     * @notice Mine a salt that produces a valid hook address
     * @dev View function — searches 50,000 salts per call.
     *      Run off-chain and pass result to deployHook().
     * @param owner The owner address that will be passed to TuringHook constructor
     */
    function mineSalt(
        address poolManager,
        address turingToken,
        address owner,
        uint256 startNonce
    ) external view returns (bytes32 validSalt, address validAddress) {
        for (uint256 i = startNonce; i < startNonce + 50000; i++) {
            bytes32 salt = bytes32(i);
            address predicted = this.predictHookAddress(
                poolManager,
                turingToken,
                owner,
                salt
            );

            if (this.validateHookAddress(predicted)) {
                return (salt, predicted);
            }
        }

        revert("No valid salt found in range");
    }
}
