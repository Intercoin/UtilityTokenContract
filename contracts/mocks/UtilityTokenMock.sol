pragma solidity >=0.6.0 <0.7.0;

import "../UtilityToken.sol";

contract UtilityTokenMock is UtilityToken {
    
    /**
     * @param name Token name
     * @param symbol Token symbol
     * 
     */
    constructor (
        string memory name, 
        string memory symbol,
        address secondary_token
    ) 
        UtilityToken(name, symbol, secondary_token) 
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


