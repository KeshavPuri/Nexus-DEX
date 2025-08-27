// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract Exchange {
    address public tokenA;
    address public tokenB;

    uint256 public reserveA;
    uint256 public reserveB;

    IERC20 public lpToken; 

    constructor(address _tokenA, address _tokenB, address _lpToken) {
        tokenA = _tokenA;
        tokenB = _tokenB;
        lpToken = IERC20(_lpToken);
    }

    function addLiquidity(uint256 _amountA, uint256 _amountB) public {
        IERC20(tokenA).transferFrom(msg.sender, address(this), _amountA);
        IERC20(tokenB).transferFrom(msg.sender, address(this), _amountB);
        reserveA += _amountA;
        reserveB += _amountB;
        
    }


    function getAmountOut(uint256 _amountIn, address _tokenIn) public view returns (uint256) {
        require(_tokenIn == tokenA || _tokenIn == tokenB, "Invalid token");
        require(reserveA > 0 && reserveB > 0, "Nexus DEX: INSUFFICIENT_LIQUIDITY"); // <-- ADD THIS LINE


        uint256 reserveIn = (_tokenIn == tokenA) ? reserveA : reserveB;
        uint256 reserveOut = (_tokenIn == tokenA) ? reserveB : reserveA;

        uint256 amountInWithFee = _amountIn * 997; // 1000 - 3 (0.3% fee)
        uint256 numerator = amountInWithFee * reserveOut; 
        uint256 denominator = (reserveIn * 1000) + amountInWithFee;

        return numerator / denominator;

        // 200 token A , 
        // 200 * 997 , 
        // 199,400 * 500 / 1000000 + 199,400
        // 83.12
    }

    function swap(uint256 _amountIn, address _tokenIn) public returns (uint256 amountOut) {
        require(_amountIn > 0, "Amount in cannot be zero");
        
        uint256 amountToReceive = getAmountOut(_amountIn, _tokenIn);
        
        address tokenOut = (_tokenIn == tokenA) ? tokenB : tokenA;

        IERC20(_tokenIn).transferFrom(msg.sender, address(this), _amountIn);

        IERC20(tokenOut).transfer(msg.sender, amountToReceive);
        
        
        if (_tokenIn == tokenA) {
            reserveA += _amountIn;    // 1000 + 200 = 1200
            reserveB -= amountToReceive; // 500 - 83.3 =  416.7
            // 
        } else {
            reserveB += _amountIn;
            reserveA -= amountToReceive;
        }

        return amountToReceive;
    }
}