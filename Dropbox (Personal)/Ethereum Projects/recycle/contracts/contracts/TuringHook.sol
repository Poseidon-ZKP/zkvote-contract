// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {BaseHook} from "./interfaces/uniswap-v4/BaseHook.sol";
import {IPoolManager} from "./interfaces/uniswap-v4/IPoolManager.sol";
import {Hooks} from "./interfaces/uniswap-v4/Hooks.sol";
import {PoolKey} from "./interfaces/uniswap-v4/PoolKey.sol";
import {BalanceDelta, BalanceDeltaLibrary} from "./interfaces/uniswap-v4/BalanceDelta.sol";
import {BeforeSwapDelta, BeforeSwapDeltaLibrary} from "./interfaces/uniswap-v4/BeforeSwapDelta.sol";
import {Currency, CurrencyLibrary} from "./interfaces/uniswap-v4/Currency.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

interface ITuringToken {
    function enterSwap() external;
    function teamWallet() external view returns (address);
}

/// @notice Minimal interface for PoolManager.take()
interface IPoolManagerTake {
    function take(Currency currency, address to, uint256 amount) external;
}

/**
 * @title TuringHook
 * @notice Uniswap V4 hook for TURING protocol
 * @dev beforeSwap: calls token.enterSwap() to set transient authorization (DEATHSTR pattern)
 *      afterSwap: collects 10% ETH fee — 1% team, 9% treasury (token contract)
 *      Immediate distribution on each swap (no accumulation threshold)
 */
contract TuringHook is BaseHook, Ownable {
    using CurrencyLibrary for Currency;
    using BalanceDeltaLibrary for BalanceDelta;

    /// @notice The TURING token
    address public immutable turingToken;

    /// @notice Burn address for deflationary TURING burns
    address public constant BURN_ADDRESS = 0x000000000000000000000000000000000000dEaD;

    /// @notice Fee rate: 10% (1000 basis points)
    uint256 public constant FEE_RATE = 1000;
    uint256 public constant BASIS_POINTS = 10000;

    /// @notice Fee split: 10% team (1% of total), 90% treasury (9% of total)
    uint256 public constant TEAM_SHARE = 1000;     // 10% of fee = 1% of swap
    uint256 public constant TREASURY_SHARE = 9000;  // 90% of fee = 9% of swap

    /// @notice Pause flag
    bool public hookPaused;

    event FeesCollected(uint256 teamAmount, uint256 treasuryAmount);
    event TuringBurned(uint256 amount);
    event HookPausedToggled(bool paused);

    constructor(
        IPoolManager _poolManager,
        address _turingToken,
        address _owner
    ) BaseHook(_poolManager) Ownable(_owner) {
        require(_turingToken != address(0), "Invalid token");
        require(_owner != address(0), "Invalid owner");
        turingToken = _turingToken;
    }

    // ═══════════════════════════════════════════════════════════════
    //                     HOOK PERMISSIONS
    // ═══════════════════════════════════════════════════════════════

    function getHookPermissions() public pure override returns (Hooks.Permissions memory) {
        return Hooks.Permissions({
            beforeInitialize: false,
            afterInitialize: false,
            beforeAddLiquidity: false,
            afterAddLiquidity: false,
            beforeRemoveLiquidity: false,
            afterRemoveLiquidity: false,
            beforeSwap: true,               // Set transient auth flag on token
            afterSwap: true,                // Collect fees
            beforeDonate: false,
            afterDonate: false,
            beforeSwapReturnDelta: false,
            afterSwapReturnDelta: true,     // Take fees via delta
            afterAddLiquidityReturnDelta: false,
            afterRemoveLiquidityReturnDelta: false
        });
    }

    // ═══════════════════════════════════════════════════════════════
    //                   LIFECYCLE — NO-OPS
    // ═══════════════════════════════════════════════════════════════

    function beforeInitialize(address, PoolKey calldata, uint160) external pure returns (bytes4) {
        return this.beforeInitialize.selector;
    }

    function afterInitialize(address, PoolKey calldata, uint160, int24) external pure returns (bytes4) {
        return this.afterInitialize.selector;
    }

    function beforeAddLiquidity(
        address, PoolKey calldata, IPoolManager.ModifyLiquidityParams calldata, bytes calldata
    ) external pure returns (bytes4) {
        return this.beforeAddLiquidity.selector;
    }

    function afterAddLiquidity(
        address, PoolKey calldata, IPoolManager.ModifyLiquidityParams calldata, BalanceDelta, bytes calldata
    ) external pure returns (bytes4) {
        return this.afterAddLiquidity.selector;
    }

    function beforeRemoveLiquidity(
        address, PoolKey calldata, IPoolManager.ModifyLiquidityParams calldata, bytes calldata
    ) external pure returns (bytes4) {
        return this.beforeRemoveLiquidity.selector;
    }

    function afterRemoveLiquidity(
        address, PoolKey calldata, IPoolManager.ModifyLiquidityParams calldata, BalanceDelta, bytes calldata
    ) external pure returns (bytes4) {
        return this.afterRemoveLiquidity.selector;
    }

    // ═══════════════════════════════════════════════════════════════
    //                   BEFORE SWAP — AUTH
    // ═══════════════════════════════════════════════════════════════

    /// @notice Set transient authorization flag on token before swap
    function beforeSwap(
        address,
        PoolKey calldata key,
        IPoolManager.SwapParams calldata,
        bytes calldata
    ) external override onlyPoolManager returns (bytes4, BeforeSwapDelta, uint24) {
        if (hookPaused) {
            return (this.beforeSwap.selector, BeforeSwapDeltaLibrary.ZERO_DELTA, 0);
        }

        // Verify this is our token pool
        require(
            Currency.unwrap(key.currency0) == turingToken || Currency.unwrap(key.currency1) == turingToken,
            "Wrong pool"
        );

        // Set transient authorization on token (DEATHSTR pattern)
        ITuringToken(turingToken).enterSwap();

        return (this.beforeSwap.selector, BeforeSwapDeltaLibrary.ZERO_DELTA, 0);
    }

    // ═══════════════════════════════════════════════════════════════
    //                   AFTER SWAP — FEES
    // ═══════════════════════════════════════════════════════════════

    /// @notice Collect 10% fee on the output (unspecified) side of the swap.
    ///         V4 flash accounting: take() tokens from pool → distribute → return positive delta.
    ///
    ///         Buy (ETH→TURING, exactIn, zeroForOne=true):
    ///           - Unspecified = currency1 (TURING) → fee in TURING → burn to 0xdead (deflationary!)
    ///         Sell (TURING→ETH, exactIn, zeroForOne=false):
    ///           - Unspecified = currency0 (ETH) → fee in ETH → split 1% team + 9% treasury
    function afterSwap(
        address,
        PoolKey calldata key,
        IPoolManager.SwapParams calldata params,
        BalanceDelta delta,
        bytes calldata
    ) external override onlyPoolManager returns (bytes4, int128) {
        if (hookPaused) {
            return (this.afterSwap.selector, 0);
        }

        // Verify pool
        require(
            Currency.unwrap(key.currency0) == turingToken || Currency.unwrap(key.currency1) == turingToken,
            "Wrong pool"
        );

        // Determine the unspecified (output) currency and its delta.
        // For exactInput (amountSpecified < 0): specified = input, unspecified = output
        // For exactOutput (amountSpecified > 0): specified = output, unspecified = input
        bool exactInput = params.amountSpecified < 0;

        // Determine unspecified currency and its delta based on swap direction.
        // afterSwapReturnDelta: return positive int128 on the unspecified side
        // to reduce swapper's output.

        Currency feeCurrency;
        int128 outputDelta;

        if (exactInput) {
            // Unspecified = output side
            if (params.zeroForOne) {
                // Buy: ETH→TURING. Output = currency1 (TURING)
                feeCurrency = key.currency1;
                outputDelta = delta.amount1();
            } else {
                // Sell: TURING→ETH. Output = currency0 (ETH)
                feeCurrency = key.currency0;
                outputDelta = delta.amount0();
            }
        } else {
            // exactOutput: unspecified = input side
            if (params.zeroForOne) {
                // zeroForOne exactOutput: specified=token1(output), unspecified=token0(input)
                feeCurrency = key.currency0;
                outputDelta = delta.amount0();
            } else {
                // !zeroForOne exactOutput: specified=token0(output), unspecified=token1(input)
                feeCurrency = key.currency1;
                outputDelta = delta.amount1();
            }
        }

        // Output delta is positive for tokens the swapper receives, negative for tokens sent.
        // We want the absolute value of the output.
        uint256 absOutput;
        if (outputDelta < 0) {
            absOutput = uint256(uint128(-outputDelta));
        } else {
            absOutput = uint256(uint128(outputDelta));
        }

        if (absOutput == 0) {
            return (this.afterSwap.selector, 0);
        }

        // 10% fee on output
        uint256 feeAmount = (absOutput * FEE_RATE) / BASIS_POINTS;
        if (feeAmount == 0) {
            return (this.afterSwap.selector, 0);
        }

        // Step 1: take() fee tokens from PoolManager into this contract
        //         This creates a NEGATIVE delta for the hook (hook owes tokens back).
        IPoolManagerTake(address(poolManager)).take(feeCurrency, address(this), feeAmount);

        // Step 2: Distribute the fee tokens
        bool feeIsETH = Currency.unwrap(feeCurrency) == address(0);

        if (feeIsETH) {
            // Sell: fee in ETH → split to team (1%) + treasury (9%)
            uint256 teamFee = (feeAmount * TEAM_SHARE) / BASIS_POINTS;
            uint256 treasuryFee = feeAmount - teamFee;

            address team = ITuringToken(turingToken).teamWallet();

            if (teamFee > 0 && team != address(0)) {
                (bool s1, ) = team.call{value: teamFee}("");
                require(s1, "Team transfer failed");
            }

            if (treasuryFee > 0) {
                (bool s2, ) = turingToken.call{value: treasuryFee}("");
                require(s2, "Treasury transfer failed");
            }

            emit FeesCollected(teamFee, treasuryFee);
        } else {
            // Buy: fee in TURING → burn (deflationary!)
            IERC20(turingToken).transfer(BURN_ADDRESS, feeAmount);
            emit TuringBurned(feeAmount);
        }

        // Step 3: Return POSITIVE int128(feeAmount) to balance the delta.
        //         take() created negative delta for hook; returning +feeAmount creates
        //         positive delta → net hook delta = 0 (balanced).
        //         This also reduces the swapper's output by feeAmount.
        return (this.afterSwap.selector, int128(int256(feeAmount)));
    }

    // ═══════════════════════════════════════════════════════════════
    //                        ADMIN
    // ═══════════════════════════════════════════════════════════════

    function setHookPaused(bool _paused) external onlyOwner {
        hookPaused = _paused;
        emit HookPausedToggled(_paused);
    }

    receive() external payable {}
}
