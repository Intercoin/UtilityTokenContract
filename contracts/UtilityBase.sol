pragma solidity >=0.6.0 <0.7.0;

import "./openzeppelin-contracts/contracts/token/ERC20/ERC20.sol";
import "./openzeppelin-contracts/contracts/access/Ownable.sol";
import "./openzeppelin-contracts/contracts/utils/ReentrancyGuard.sol";

import "./Whitelist.sol";
import "./CommonConstants.sol";
import "./Claimed.sol";

contract UtilityBase is ERC20, Ownable, CommonConstants, Whitelist, Claimed, ReentrancyGuard {
    using SafeMath for uint256;
    using Address for address;
    
    uint256 public maxGasPrice = 1 * DECIMALS;
    
    uint256 startTime;
    
    uint256 claimMorePerSeconds = 10 * DECIMALS;

    // initial amount that can be claimed by contract without transactions failing
    uint256 claimInitialMax = 1000000 * DECIMALS;
    
    // amount that can be claimed one-time by contract without transactions failing
    uint256 tokensClaimOneTimeLimit = 1000000 * DECIMALS;
    
    // consider total token2 balance held at start of block when sending, 
    // claim fails if we would have new token1outstanding * exchangeRate > token2balance * (100 - this number) / 100
    uint256 claimReserveMinPercent = 20;
    
    // consider total token2 balance held at start of block when sending, 
    // claim fails if token1beingSent * exchangeRate > token2balance * this number / 100
    uint256 claimTransactionMaxPercent = 2;
    
    // deficit = token1outstanding * exchangeRate - token2balance . 
    // claim fails if claimDeficitMax exceeds this number.
    uint256 claimDeficitMax = 1000000 * DECIMALS;
    
    // claim discount
    uint256 claimReserveExchangeRate = 99e4;
    
    // total claimed
    uint256 claimTotal = 0;
    
    // default variable for claim permissions
    uint256 claimLockupPeriod = 100; // seconds
    uint256 claimLockupPercent = 100e4; // percent mul by 1e6  default is 100%
    
    bool claimGradual = true;
    
    uint256 private tokensForClaimingCount = 0;
    address[] private tokensForClaiming;
    mapping (address => bool) private tokensForClaimingMap;
    
    uint256 internal _sellExchangeRate = 99e4; // 99% * 1e6
    uint256 internal _buyExchangeRate = 100e4; // 100% *1e6
    
    uint256 reserveTokenLimitPerDay = 20e4; // 20% * 1e6
    mapping (address => uint256) lastObtainedReserveToken;
    
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
        startTime = now;
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
    
    
    function claimingTokensWithdraw() public onlyOwner nonReentrant() {
        
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
    function claim() validGasPrice public nonReentrant() {
        
        require(tokensForClaimingCount > 0, 'There are no allowed tokens for claiming');
        
        bool hasAllowedAmount = false;
        
        for (uint256 i = 0; i < tokensForClaimingCount; i++) {
        
            uint256 allowedAmount = IERC20(tokensForClaiming[i]).allowance(_msgSender(), address(this));
            
            if (allowedAmount > 0) {
            
                hasAllowedAmount = true;
                
                // own token with rate 1to1
                uint256 amount = allowedAmount;
                
                claimTotal = claimTotal.add(amount);
                
                if (claimTotal <= claimInitialMax) {
                    //allow claim without check any restrictions;
                } else {
                    require(
                        (claimTotal < claimInitialMax.add(((now).sub(startTime)).mul(claimMorePerSeconds))), 
                        'This many tokens are not available to be claimed yet' 
                    );
                    require(
                        claimTotal.mul(claimReserveExchangeRate).div(1e6) <= _overallBalance2().mul(100-claimReserveMinPercent).div(100), 
                        'Amount exceeds available reserve limit' 
                    );
                    require(
                        amount.mul(claimReserveExchangeRate).div(1e6) <= _overallBalance2().mul(claimTransactionMaxPercent).div(100),
                        'Amount exceeds transaction max percent' 
                    );
                    
                    require(
                        ((claimTotal).mul(claimReserveExchangeRate).div(1e6)).sub(_overallBalance2()) <= claimDeficitMax,
                        'Amount exceeds deficit max'
                    );
            
                }
               
                require(tokensClaimOneTimeLimit >= amount, 'Too many tokens to claim in one transaction');
                
                
                // try to get
                bool success = IERC20(tokensForClaiming[i]).transferFrom(_msgSender(), address(this), allowedAmount);
                require(success == true, 'Transfer tokens were failed'); 
                
                // claim own tokens
                _mint(_msgSender(), amount);
                
                //
                
                addClaimLimit(_msgSender(), amount.mul(claimLockupPercent).div(1e6), now.add(claimLockupPeriod), claimGradual);
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
    function transfer(address recipient, uint256 amount) public onlyPassTransferLimit(amount) nonReentrant() virtual override returns (bool) {
      
        uint256 senderBalanceBefore =  balanceOf(_msgSender());
        _transfer(_msgSender(), recipient, amount);
        
        if (recipient == address(this)) {
            
            
            _receivedToken(amount, senderBalanceBefore);
            _burn(address(this), amount);
        }
        
        return true;
    }
    
    function _overallBalance2() internal view virtual returns(uint256) {
        // need to be implement in child
        return 0;
    }
    
    /**
     * @dev private method. getting Tokens and send back eth(token2)
     * Available only to recipient in whitelist
     * @param tokensAmount tokens amount
     */
    function _receivedToken(uint256 tokensAmount, uint256 tokensBalanceBefore) internal onlyWhitelist {
        
        uint256 balanceToken2 = _overallBalance2();
        uint256 amount2send = tokensAmount.mul(sellExchangeRate()).div(1e6); // "sell exchange" interpretation with rate discount
        require ((amount2send <= balanceToken2 && balanceToken2>0), 'Amount exceeds available balance.');
        
        require (
            (now.sub(lastObtainedReserveToken[_msgSender()]) >= 86400),
            'Available only one time in 24h.'
        );
        require (
            (tokensAmount.mul(1e6)).div(tokensBalanceBefore) <= reserveTokenLimitPerDay,
            'Amount exceeds available reserve token limit.'
        );
        
        lastObtainedReserveToken[_msgSender()] = now;

        
        
        
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
    
     /**
     * @dev sell exchange rate
     * @return rate multiplied at 1e6
     */
    function sellExchangeRate() internal view returns(uint256) {
        return _sellExchangeRate;
    }
    
    /**
     * @dev buy exchange rate
     * @return rate multiplied at 1e6
     */
    function buyExchangeRate() internal view returns(uint256) {
        return _buyExchangeRate;
    }  
    
    
    function _mintedOwnTokens(uint256 amount) internal {
        uint256 amount2mint = amount.mul(buyExchangeRate()).div(1e6); // "buy exchange" interpretation with rate 100%
        _mint(_msgSender(), amount2mint);
    } 
}



