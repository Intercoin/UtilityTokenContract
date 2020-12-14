// SPDX-License-Identifier: MIT
pragma solidity >=0.6.0 <0.7.0;

import "./UtilityBase.sol";

contract UtilityTokenETHOnly is UtilityBase {
    
    /**
     * @param name Token name
     * @param symbol Token symbol
     * 
     */
    constructor (
        string memory name, 
        string memory symbol
    ) 
        UtilityBase(name, symbol) 
        public 
    {
        // override variables can be here
        claimLockupPercent = 100e4;
        _sellExchangeRate = 50e4;
        
        
        _buyExchangeRate = 10000e4; // 1000%   1Eth == 100ITRF
        _sellExchangeRate = 1e4; // 1% 1IRTF = 0.01eth

        claimReserveMinPercent = 50;
        claimTransactionMaxPercent = 2;
        claimLockupPeriod = 8640000;// 100 days
        claimGradual = true;
        // ------------------------------
    }
    
    /**
     * Used for donate ETH without receiving token
     */
    function donateETH() public payable validGasPrice nonReentrant() {
    }


    /**
     * @dev overall balance (in this case - eth)
     */
    function _reserveTokenBalance() internal view virtual override returns(uint256) {
        return address(this).balance;
    }
    
    /**
     * @dev internal overrided method. After getting native tokens contract should transfer eth to sender
     * @param amount2send amount of eth
     */
    function _transferReserveToken(uint256 amount2send) internal virtual override {
        address payable addr1 = payable(_msgSender()); // correct since Solidity >= 0.6.0
        bool success = addr1.send(amount2send);
        require(success == true, 'Transfer ether was failed'); 
    }
   
}


