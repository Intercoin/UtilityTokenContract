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
        string memory symbol,
        ICommunity community, 
        uint256 inviterCommission
    ) 
        UtilityTokenETHOnly(name, symbol, community, inviterCommission) 
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
    function getReserveTokenLimitPerDay() public view returns(uint256) {
        return reserveTokenLimitPerDay;
    }
    
    function getClaimsParams() public view returns(uint256,uint256,uint256,uint256,uint256,uint256) {
        return (claimInitialMax, claimMorePerSeconds,claimReserveMinPercent,claimMaxPercent,claimDeficitMax,claimMaxLimit);
    }
    
    function setClaimsParams(uint256 p1, uint256 p2, uint256 p3, uint256 p4, uint256 p5, uint256 p6) public {
        claimInitialMax = p1;
        claimMorePerSeconds = p2;
        claimReserveMinPercent = p3;
        claimMaxPercent = p4;
        claimDeficitMax = p5;
        claimMaxLimit = p6;
    } 
    
}


