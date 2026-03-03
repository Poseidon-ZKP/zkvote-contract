// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IHooks} from "./interfaces/uniswap-v4/IHooks.sol";
import {Currency} from "./interfaces/uniswap-v4/Currency.sol";
import {PoolKey} from "./interfaces/uniswap-v4/PoolKey.sol";
import {TickMath} from "./interfaces/uniswap-v4/TickMath.sol";

interface IPositionManager {
    function initializePool(
        PoolKey calldata key,
        uint160 sqrtPriceX96
    ) external payable returns (int24);
    function modifyLiquidities(bytes calldata unlockData, uint256 deadline) external payable;
    function multicall(bytes[] calldata data) external payable returns (bytes[] memory results);
}

interface IAllowanceTransfer {
    function approve(address token, address spender, uint160 amount, uint48 expiration) external;
}

/**
 * @title TuringLiquidityLoaderV4
 * @notice Fixed loader for TURING V4 pool — tickUpper above current tick for active liquidity.
 * @dev Fixes from V3:
 *      - tickUpper = 138170 (ABOVE current tick 138162 — position straddles current price)
 *      - msg.value >= 0.45 ETH (position needs ETH because it spans the current tick)
 *      - amount0Max = msg.value (ETH from caller)
 *      - Includes recover() for emergency token/ETH recovery
 *
 *      Same PNKSTR-proven pattern:
 *      1. 2-param initializePool via posm.initializePool.selector
 *      2. MINT_POSITION (0x02) + SETTLE_PAIR (0x0d) from v4-periphery Actions.sol
 *      3. Direct posm.multicall{value: msg.value}(params)
 *      4. Permit2 approval chain for token settlement
 */
contract TuringLiquidityLoaderV4 {
    IPositionManager public immutable posm;
    IAllowanceTransfer public immutable permit2;
    address public immutable token;
    address public immutable owner;

    // V4 PositionManager action IDs — verified from v4-periphery Actions.sol
    uint8 constant MINT_POSITION = 0x02;
    uint8 constant SETTLE_PAIR = 0x0d;

    constructor(address _positionManager, address _permit2, address _token) {
        posm = IPositionManager(_positionManager);
        permit2 = IAllowanceTransfer(_permit2);
        token = _token;
        owner = msg.sender;
    }

    /**
     * @notice Load liquidity with position straddling current tick (active liquidity).
     * @param _hook The hook address for the pool
     * @dev Call with >= 0.45 ETH: loader.loadLiquidity{value: 0.5 ether}(hookAddr)
     *
     *      Price: 1M TURING per ETH -> sqrtPriceX96 = sqrt(1,000,000) * 2^96 = 1000 * 2^96
     *      Current tick = 138162
     *      Position: tickLower = -887270, tickUpper = 138170 (ABOVE current tick)
     *      -> Two-sided: needs both TURING + ETH because position straddles current tick.
     *      -> ~0.45 ETH needed for the ETH side of the position.
     */
    function loadLiquidity(address _hook) external payable {
        require(msg.sender == owner, "Only owner");
        require(msg.value >= 0.45 ether, "Need >= 0.45 ETH");

        uint256 tokenBalance = IERC20(token).balanceOf(address(this));
        require(tokenBalance > 0, "No tokens");

        Currency currency0 = Currency.wrap(address(0)); // ETH
        Currency currency1 = Currency.wrap(token);       // TURING

        uint24 lpFee = 0;
        int24 tickSpacing = 10;

        // 1M TURING per ETH: sqrtPriceX96 = sqrt(1,000,000) * 2^96 = 1000 * 2^96
        uint160 startingPrice = 79228162514264337593543950336000;

        int24 tickLower = TickMath.minUsableTick(tickSpacing); // -887270
        int24 tickUpper = int24(138170);                        // ABOVE current tick 138162

        PoolKey memory key = PoolKey(currency0, currency1, lpFee, tickSpacing, IHooks(_hook));
        bytes memory hookData = new bytes(0);

        // Amounts: full ETH from caller + full token balance
        uint256 amount0Max = msg.value;              // ETH from caller
        uint256 amount1Max = tokenBalance + 1;       // full balance + 1 wei margin

        // Liquidity calculation: conservative underestimate
        // For a position straddling the current tick, liquidity is bounded by the token side:
        // L = tokenBalance / (sqrtRatio(tickUpper) - sqrtRatio(currentTick))
        // Using tokenBalance / 1000 as safe underestimate (same as V3)
        uint128 liquidity = uint128(tokenBalance / 1000);

        // Build mint params — exact PNKSTR _mintLiquidityParams pattern
        bytes memory actions = abi.encodePacked(uint8(MINT_POSITION), uint8(SETTLE_PAIR));

        bytes[] memory mintParams = new bytes[](2);
        mintParams[0] = abi.encode(
            key, tickLower, tickUpper, liquidity,
            amount0Max, amount1Max,
            address(this), hookData
        );
        mintParams[1] = abi.encode(key.currency0, key.currency1);

        // Multicall: initializePool + modifyLiquidities — PNKSTR pattern
        bytes[] memory params = new bytes[](2);
        params[0] = abi.encodeWithSelector(
            posm.initializePool.selector,
            key, startingPrice
        );
        params[1] = abi.encodeWithSelector(
            posm.modifyLiquidities.selector,
            abi.encode(actions, mintParams),
            block.timestamp + 60
        );

        // Approval chain: token -> Permit2 -> PositionManager
        IERC20(token).approve(address(permit2), type(uint256).max);
        permit2.approve(token, address(posm), type(uint160).max, type(uint48).max);

        // Execute multicall with ETH — direct call like PNKSTR/VIBESTRATEGY
        posm.multicall{value: msg.value}(params);
    }

    /**
     * @notice Emergency function to recover tokens and ETH
     */
    function recover() external {
        require(msg.sender == owner, "Only owner");

        uint256 tokenBalance = IERC20(token).balanceOf(address(this));
        if (tokenBalance > 0) {
            IERC20(token).transfer(owner, tokenBalance);
        }

        uint256 ethBalance = address(this).balance;
        if (ethBalance > 0) {
            payable(owner).transfer(ethBalance);
        }
    }

    receive() external payable {}
}
