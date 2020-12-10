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

    function setClaimGradual(bool value) public {
        claimGradual = value;
    }
    
    function setClaimLockupPeriod(uint256 value) public {
        claimLockupPeriod = value;
    }
 
    function getIndexClaimed(uint256 i) public view returns( uint256, uint256, uint256, bool) {
        return (_claimed[msg.sender][i].amount, _claimed[msg.sender][i].startTime, _claimed[msg.sender][i].endTime, _claimed[msg.sender][i].gradual);
    }
 
    function getNow() public view returns( uint256) {
        return now;
    }
   
    function getSellExchangeRate() public view returns(uint256) {
        return _sellExchangeRate;
    }
    
    function getBuyExchangeRate() public view returns(uint256) {
        return _buyExchangeRate;
    }  
}


