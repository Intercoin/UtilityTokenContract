pragma solidity >=0.6.0 <0.7.0;

import "../UtilityTokenETHOnly.sol";

contract UtilityTokenETHOnlyMock is UtilityTokenETHOnly {
    
    /**
     * @param name Token name
     * @param symbol Token symbol
     * 
     */
    constructor (
        string memory name, 
        string memory symbol
    ) 
        UtilityTokenETHOnly(name, symbol) 
        public 
    {
//        _discount = discount;
    }

    function setGrantGradual(bool value) public {
        grantGradual = value;
    }
    function setGrantLockupUntilBlockDiff(uint256 value) public {
        grantLockupUntilBlockDiff = value;
    }
    
}


