pragma solidity >=0.6.0 <0.7.0;

import "./openzeppelin-contracts/contracts/math/SafeMath.sol";

/**
 * Realization a restriction limits for user transfer
 * 
 */
contract Granted {
    using SafeMath for uint256;
    
    // user allowance
    struct GrantStruct {
        uint256 amount;
        uint256 startBlock;
        uint256 endBlock;
        bool gradual;
    }

    mapping (address => GrantStruct[]) private _granted;
    
    /**
     * @param recipient recipient's address
     * @param amount token amount
     * @param endBlock block number in which limit expire
     * @param gradual if true then limit is gradually decreasing
     */
    function addGrantLimit(address recipient, uint256 amount, uint256 endBlock, bool gradual) internal {
        require(block.number <= endBlock, "endBlock need to be more than current Block Number");
        
        GrantStruct memory newGrant = GrantStruct({
            amount: amount, 
            startBlock: block.number, 
            endBlock: endBlock, 
            gradual: gradual
        });

        uint256 grantCount = _granted[recipient].length;
        _granted[recipient].push(newGrant);
    }
    
    /**
     * Calculate minimum amount of tokens need to be left at recipient's account
     * @dev method additionally cleaned _granted if endBlock was expired
     * @param recipient recipient's address
     * @return minimum amount of tokens need to be left at recipient's account
     */
    function getAmountLockUp(address recipient) internal returns (uint256 minimum)  {
        
        minimum = 0;
        
        uint256 grantCount = _granted[recipient].length;
        uint256 tmpIndex;
        uint256 tmpPerBlock;
        for (uint256 i = 0; i < grantCount; i++) {
            
            // loop by expired and delete them from array by exchanging from last element to current
            while (block.number > _granted[recipient][i].endBlock && grantCount > 0) {
                tmpIndex = _granted[recipient].length - 1;
                
                if (i != tmpIndex) {
                    _granted[recipient][i] = _granted[recipient][tmpIndex];
                }

                _granted[recipient].pop();
                
                // decrease grantCount
                grantCount--;
                if (i == tmpIndex) {
                    break;
                }
            }
            
            if (grantCount == 0) {
                break;
            }
            
            minimum = minimum.add(_granted[recipient][i].amount);
            
            // if gradual then minimum decreasing until reached endBlock
            if (_granted[recipient][i].gradual == true) {
                // calculate how much amount descreasing per block
                tmpPerBlock = (_granted[recipient][i].amount).div(_granted[recipient][i].endBlock.sub(_granted[recipient][i].startBlock));
                // and now sub
                minimum = minimum.sub((block.number.sub(_granted[recipient][i].startBlock)).mul(tmpPerBlock));
            }
        }
    }
    
    /** Do the same as getAmountLockUp but without gas spent (without cleanup expired grant)
     * @param recipient recipient's address
     */
    function amountLockUp(address recipient) public view returns (uint256 minimum)  {
        minimum = 0;
        uint256 tmpPerBlock;
        uint256 grantCount = _granted[recipient].length;
        for (uint256 i = 0; i < grantCount; i++) {

            if (block.number < _granted[recipient][i].endBlock) {
                minimum = minimum.add(_granted[recipient][i].amount);
                
                // if gradual then minimum decreasing until reached endBlock
                if (_granted[recipient][i].gradual == true) {
                    // calculate how much amount descreasing per block
                    tmpPerBlock = (_granted[recipient][i].amount).div(_granted[recipient][i].endBlock.sub(_granted[recipient][i].startBlock));
                    // and now sub
                    minimum = minimum.sub((block.number.sub(_granted[recipient][i].startBlock)).mul(tmpPerBlock));
                }
            }
        }
    }
    
}