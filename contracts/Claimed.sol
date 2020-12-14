// SPDX-License-Identifier: MIT
pragma solidity >=0.6.0 <0.7.0;

import "./openzeppelin-contracts/contracts/math/SafeMath.sol";

/**
 * Realization a restriction limits for user transfer
 * 
 */
contract Claimed {
    using SafeMath for uint256;
    
    // user allowance
    struct ClaimStruct {
        uint256 amount;
        uint256 startTime;
        uint256 endTime;
        bool gradual;
    }

    mapping (address => ClaimStruct[]) internal _claimed;
    
    /**
     * @param recipient recipient's address
     * @param amount token amount
     * @param endTime timestamp in which limit expire
     * @param gradual if true then limit is gradually decreasing
     */
    function addClaimLimit(address recipient, uint256 amount, uint256 endTime, bool gradual) internal {
        require(now <= endTime, "endTime need to be more than current timestamp");
        
        ClaimStruct memory newClaim = ClaimStruct({
            amount: amount, 
            startTime: now, 
            endTime: endTime, 
            gradual: gradual
        });

        //uint256 claimCount = _claimed[recipient].length;
        _claimed[recipient].push(newClaim);
    }
    
    /**
     * Calculate minimum amount of tokens need to be left at recipient's account
     * @dev method additionally cleaned _claimed if endTime was expired
     * @param recipient recipient's address
     * @return minimum amount of tokens need to be left at recipient's account
     */
    function getAmountLockUp(address recipient) internal returns (uint256 minimum)  {
        
        minimum = 0;
        
        uint256 claimCount = _claimed[recipient].length;
        uint256 tmpIndex;
        uint256 tmpPerSecond;
        for (uint256 i = 0; i < claimCount; i++) {
            
            // loop by expired and delete them from array by exchanging from last element to current
            while (now > _claimed[recipient][i].endTime && claimCount > 0) {
                tmpIndex = _claimed[recipient].length - 1;
                
                if (i != tmpIndex) {
                    _claimed[recipient][i] = _claimed[recipient][tmpIndex];
                }

                _claimed[recipient].pop();
                
                // decrease claimCount
                claimCount--;
                if (i == tmpIndex) {
                    break;
                }
            }
            
            if (claimCount == 0) {
                break;
            }
            
            minimum = minimum.add(_claimed[recipient][i].amount);
            
            // if gradual then minimum decreasing until reached endTime
            if (_claimed[recipient][i].gradual == true) {
                // calculate how much amount descreasing per second
                tmpPerSecond = (_claimed[recipient][i].amount).div(_claimed[recipient][i].endTime.sub(_claimed[recipient][i].startTime));
                // and now sub
                minimum = minimum.sub((now.sub(_claimed[recipient][i].startTime)).mul(tmpPerSecond));
            }
        }
    }
    
    /** Do the same as getAmountLockUp but without gas spent (without cleanup expired claim)
     * @param recipient recipient's address
     */
    function amountLockUp(address recipient) public view returns (uint256 minimum)  {
        minimum = 0;
        uint256 tmpPerSecond;
        uint256 claimCount = _claimed[recipient].length;
        for (uint256 i = 0; i < claimCount; i++) {

            if (now < _claimed[recipient][i].endTime) {
                minimum = minimum.add(_claimed[recipient][i].amount);
                
                // if gradual then minimum decreasing until reached endTime
                if (_claimed[recipient][i].gradual == true) {
                    // calculate how much amount descreasing per second
                    tmpPerSecond = (_claimed[recipient][i].amount).div(_claimed[recipient][i].endTime.sub(_claimed[recipient][i].startTime));
                    // and now sub
                    minimum = minimum.sub((now.sub(_claimed[recipient][i].startTime)).mul(tmpPerSecond));
                }
            }
        }
    }
    
}