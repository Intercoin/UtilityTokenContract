pragma solidity >=0.6.0 <0.7.0;

//import "https://github.com/OpenZeppelin/openzeppelin-contracts/blob/master/contracts/token/ERC20/ERC20.sol";
//import "https://github.com/OpenZeppelin/openzeppelin-contracts/blob/master/contracts/access/Ownable.sol";
import "./openzeppelin-contracts/contracts/token/ERC20/ERC20.sol";
import "./openzeppelin-contracts/contracts/access/Ownable.sol";

import "./Whitelist.sol";
import "./CommonConstants.sol";
import "./Granted.sol";

contract UtilityBase is ERC20, Ownable, CommonConstants, Whitelist, Granted {
    using SafeMath for uint256;
    using Address for address;
    
    uint256 public maxGasPrice = 1 * DECIMALS;
    
    uint256 firstBlockNumber;
    
    uint256 constant grantMorePerBlock = 10 * DECIMALS;
    
    // initial amount that can be granted by contract without transactions failing
    uint256 constant grantInitialMax = 1000000 * DECIMALS;
    
    // amount that can be granted one-time by contract without transactions failing
    uint256 tokensGrantOneTimeLimit = 1000000 * DECIMALS;
    
    // consider total token2 balance held at start of block when sending, 
    // grant fails if we would have new token1outstanding * exchangeRate > token2balance * (100 - this number) / 100
    uint256 grantReserveMinPercent = 20;
    
    // consider total token2 balance held at start of block when sending, 
    // grant fails if token1beingSent * exchangeRate > token2balance * this number / 100
    uint256 grantTransactionMaxPercent = 2;
    
    // deficit = token1outstanding * exchangeRate - token2balance . 
    // Grant fails if grantDeficitMax exceeds this number.
    uint256 constant grantDeficitMax = 1000000 * DECIMALS;
    
    // grant discount
    uint256 grantReserveExchangeRate = 99e4;
    
    // total granted
    uint256 grantTotal = 0;
    
    // default variable for grant permissions
    uint256 grantLockupUntilBlockDiff = 100;
    bool grantGradual = true;
    
    uint256 private tokensForClaimingCount = 0;
    address[] private tokensForClaiming;
    mapping (address => bool) private tokensForClaimingMap;
    
    modifier onlyPassTransferLimit(uint256 amount) {
         require(
            getAmountLockUp(_msgSender()).add(amount) <= balanceOf(_msgSender()), 
            'TransferLimit: There are no allowance tokens to transfer'
        );
        _;
    }

    event claimingTokenAdded(address token);

    /**
     * @param name Token name
     * @param symbol Token symbol
     * 
     */
    constructor (
        string memory name, 
        string memory symbol
    ) 
        ERC20(name, symbol) 
        Whitelist() 
        public 
    {
        firstBlockNumber = block.number;
    }
    
    modifier validGasPrice() {
        require(tx.gasprice <= maxGasPrice, "Transaction gas price cannot exceed maximum gas price.");
        _;
    } 
    
    // 
    /**
     * Recieved ether and transfer token to sender
     */
    receive() external payable virtual validGasPrice {
        _receivedETH(msg.value);
    }
    
    /**
     * Setting maximum Gas Price
     * @param gasPrice maximum Gas Price(in wei) used for transaction
     */
    function setMaxGasPrice(uint256 gasPrice) public onlyOwner {
        maxGasPrice = gasPrice;
    }
    
    function claimingTokenAdd(address tokenForClaiming) public onlyOwner {
        require(tokenForClaiming.isContract(), 'tokenForClaiming must be a contract address');
        if (tokensForClaimingMap[tokenForClaiming]) {
            // already exist
        } else {
            tokensForClaiming.push(tokenForClaiming);
            tokensForClaimingCount = tokensForClaimingCount.add(1);
            tokensForClaimingMap[tokenForClaiming] = true;
            emit claimingTokenAdded(tokenForClaiming);
        }
    }
    
    /**
     * @return list list of tokens added for claiming
     */
    function claimingTokensView() public view returns (address[] memory list) {
        list = tokensForClaiming;
    }
    
    
    function claimingTokensWithdraw() public onlyOwner returns (address[] memory list) {
        
        for (uint256 i = 0; i < tokensForClaimingCount; i++) {
            uint256 amount = IERC20(tokensForClaiming[i]).balanceOf(address(this));
            if (amount > 0) {
                // try to get
                bool success = IERC20(tokensForClaiming[i]).transferFrom(address(this), owner(), amount);
                require(success == true, 'Transfer tokens were failed'); 
            }
        }

    }
    
    /**
     * @dev getting own tokens instead claimed tokens
     */
    function claim() validGasPrice public {
        
        require(tokensForClaimingCount > 0, 'There are no allowed tokens for claiming');
        
        bool hasAllowedAmount = false;
        
        for (uint256 i = 0; i < tokensForClaimingCount; i++) {
        
            uint256 allowedAmount = IERC20(tokensForClaiming[i]).allowance(_msgSender(), address(this));
            
            if (allowedAmount > 0) {
            
                hasAllowedAmount = true;
                
                // own token with rate 1to1
                uint256 amount = allowedAmount;
                
                grantTotal = grantTotal.add(amount);
                
                if (grantTotal <= grantInitialMax) {
                    //allow grant without check any restrictions;
                } else {
                    require(
                        (grantTotal < grantInitialMax.add(((block.number).sub(firstBlockNumber)).mul(grantMorePerBlock))), 
                        'This many tokens are not available to be granted yet' 
                    );
                    require(
                        grantTotal.mul(grantReserveExchangeRate).div(1e6) <= _overallBalance2().mul(100-grantReserveMinPercent).div(100), 
                        'Amount exceeds available reserve limit' 
                    );
                    require(
                        amount.mul(grantReserveExchangeRate).div(1e6) <= _overallBalance2().mul(grantTransactionMaxPercent).div(100),
                        'Amount exceeds transaction max percent' 
                    );
                    
                    require(
                        ((grantTotal).mul(grantReserveExchangeRate).div(1e6)).sub(_overallBalance2()) <= grantDeficitMax,
                        'Amount exceeds deficit max'
                    );
            
                }
               
                require(tokensGrantOneTimeLimit >= amount, 'Too many tokens to grant in one transaction');
                
                
                // try to get
                bool success = IERC20(tokensForClaiming[i]).transferFrom(_msgSender(), address(this), allowedAmount);
                require(success == true, 'Transfer tokens were failed'); 
                
                // grant own tokens
                _mint(_msgSender(), amount);
                
                //
                addGrantLimit(_msgSender(), amount, block.number.add(grantLockupUntilBlockDiff), grantGradual);
            }
        }
        require(hasAllowedAmount == true, 'Amount exceeds allowed balance');
    }
    
    /**
     * Overrode {ERC20-transfer} method.
     * There are added some features:
     * 1. added validation of restriction limit to transfer
     * 2. if recipient is self contract than we will 
     *      get tokens, burn it and transfer eth to sender (if whitelisted)
     *      In all over cases its simple ERC20 Transfer
     * 
     * @param recipient recipient
     * @param amount amount
     * @return success
     */
    function transfer(address recipient, uint256 amount) public onlyPassTransferLimit(amount) virtual override returns (bool) {
      
        _transfer(_msgSender(), recipient, amount);
        
        if (recipient == address(this)) {
            _receivedToken(amount);
            _burn(address(this), amount);
        }
        
        return true;
    }
    
    function _overallBalance2() internal virtual returns(uint256) {
        // need to be implement in child
        return 0;
    }
    
    /**
     * @dev private method. getting Tokens and send back eth(token2)
     * Available only to recipient in whitelist
     * @param tokensAmount tokens amount
     */
    function _receivedToken(uint256 tokensAmount) internal onlyWhitelist {
        
        uint256 balanceToken2 = _overallBalance2();
        uint256 amount2send = tokensAmount.mul(sellExchangeRate()).div(1e6); // "sell exchange" interpretation with rate discount
        require ((amount2send <= balanceToken2 && balanceToken2>0), 'Amount exceeds available balance.');
        
        _receivedTokenAfter(amount2send);
        
    }
    
    function _receivedTokenAfter(uint256 amount2send) internal virtual {
        // need to be implement in child
    }  
    
    
    /**
     * @dev private method. getting ETH and send back minted tokens
     * @param ethAmount ether amount
     */
    function _receivedETH(uint256 ethAmount) internal virtual {
        // need to be implement in child
    }  
    
    function sellExchangeRate() internal virtual returns(uint256) {
        // need to be implement in child
        return uint256(1e6);
    }
    function buyExchangeRate() internal virtual returns(uint256) {
        // need to be implement in child
        return uint256(1e6);
    }  
    function _mintedOwnTokens(uint256 amount) internal {
        uint256 amount2mint = amount.mul(buyExchangeRate()).div(1e6); // "buy exchange" interpretation with rate 100%
        _mint(_msgSender(), amount2mint);
    } 
}



