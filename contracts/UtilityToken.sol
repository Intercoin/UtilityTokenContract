// SPDX-License-Identifier: MIT
pragma solidity >=0.6.0 <0.7.0;

import "./UtilityBase.sol";

contract UtilityToken is UtilityBase {
    using Address for address;
    
    address private reserveTokenAddress;
    
    /**
     * @param name Token name
     * @param symbol Token symbol
     * @param reserveToken ReserveToken address instead ETH
     * 
     */
    constructor (
        string memory name, 
        string memory symbol,
        address reserveToken
    ) 
        UtilityBase(name, symbol) 
        public 
    {
        require(reserveToken.isContract(), 'reserveToken must be a contract address');
        reserveTokenAddress = reserveToken;
        
        // override variables can be here
        // ------------------------------
    }
    
    // 
    /**
     * Recieved ether 
     */
    receive() external payable override validGasPrice {
        require (true == true, "This method is not supported"); 
    }

    /**
     * @dev getting reserve tokens and mint instead native tokens
     * proceeded if user set allowance in reserveToken contract
     * @param isDonate if set true, contract will not send tokens
     */
    function receiveReserveToken(bool isDonate) validGasPrice public nonReentrant() {
        uint256 _allowedAmount = IERC20(reserveTokenAddress).allowance(_msgSender(), address(this));
        
        require(_allowedAmount > 0, 'Amount exceeds allowed balance');
        
        // try to get
        bool success = IERC20(reserveTokenAddress).transferFrom(_msgSender(), address(this), _allowedAmount);
        require(success == true, 'Transfer tokens were failed'); 
        if (!isDonate) {
            _mintedNativeToken(_allowedAmount);
        }
    }
    /**
     * @dev internal overrided method. After getting native tokens contract should transfer reserve tokens to sender
     * @param amount2send amount of reserve tokens
     */
    function _transferReserveToken(uint256 amount2send) internal virtual override {
        bool success = IERC20(reserveTokenAddress).transfer(_msgSender(),amount2send);
        require(success == true, 'Transfer tokens were failed');    
    }
    
    /**
     * @dev reserve tokens balance of this contract
     */
    function _reserveTokenBalance() internal view virtual override returns(uint256) {
        return IERC20(reserveTokenAddress).balanceOf(address(this));
    }
   
}

