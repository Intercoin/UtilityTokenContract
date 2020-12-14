// SPDX-License-Identifier: MIT
pragma solidity >=0.6.0 <0.7.0;

import "./openzeppelin-contracts/contracts/token/ERC20/ERC20.sol";
import "./openzeppelin-contracts/contracts/access/Ownable.sol";
import "./openzeppelin-contracts/contracts/utils/ReentrancyGuard.sol";

import "./Whitelist.sol";
import "./Claimed.sol";

contract UtilityBase is ERC20, Ownable, Whitelist, Claimed, ReentrancyGuard {
    using SafeMath for uint256;
    using Address for address;
    
    // Fraction part. means 1e18
    uint256 constant public DECIMALS = 10**18;
    
    uint256 public maxGasPrice = 1 * DECIMALS;
    
    uint256 startTime;
    
    uint256 claimMorePerSeconds = 10 * DECIMALS;

    // initial amount that can be claimed by contract without transactions failing
    uint256 claimInitialMax = 1000000 * DECIMALS;
    
    // amount that can be claimed one-time by contract without transactions failing
    uint256 claimTransactionMaxLimit = 1000000 * DECIMALS;
    
    // consider reserveTokenBalance balance held at start of block when sending, 
    // claim fails if we would have new potentialNativeTokenTotal * sellExchangeRate > reserveTokenBalance * (100 - this number) / 100
    uint256 claimReserveMinPercent = 20;
    
    // consider reserveTokenBalance balance held at start of block when sending, 
    // claim fails if nativeTokenBeingSent * sellExchangeRate > reserveTokenBalance * this number / 100
    uint256 claimTransactionMaxPercent = 2;
    
    // deficit = nativeTokenOutstanding * sellExchangeRate - reserveTokenBalance . 
    // claim fails if claimDeficitMax exceeds this number.
    uint256 claimDeficitMax = 1000000 * DECIMALS;
    
    // default variable for claim permissions
    uint256 claimLockupPeriod = 100; // seconds
    uint256 claimLockupPercent = 100e4; // percent mul by 1e6  default is 100%
    
    bool claimGradual = true;
    
    /**
     * @param maxClaimingSpeed: 2e4, // 2% of sender balance
     * @param ownerCanWithdraw: true, // owner withdraw it
     * @param ownerThrottleWithdraw: 60*60*24*365/2,
     * @param ownerWithdrawLast stored time automatically when owner withdraw
     * @param exchangeRate: 100e4, // 1 ITRF for 1 ITR (optional)
     * @param exists   flag needed to check exists in mapping structure
     */
    struct ClaimingTokenInfo {
        uint256 maxClaimingSpeed;
        bool ownerCanWithdraw;
        uint256 ownerThrottleWithdraw;
        uint256 ownerWithdrawLast;
        uint256 exchangeRate;
        bool exists;
    }
    uint256 private tokensForClaimingCount = 0;
    address[] private tokensForClaiming;
    mapping (address => ClaimingTokenInfo) private tokensForClaimingMap;
    
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
     * Recieved ether and transfer native tokens to sender
     */
    receive() external payable virtual validGasPrice {
        _mintedNativeToken(msg.value);
    }
    
    /**
     * Setting maximum Gas Price
     * @param gasPrice maximum Gas Price(in wei) used for transaction
     */
    function setMaxGasPrice(uint256 gasPrice) public onlyOwner {
        maxGasPrice = gasPrice;
    }
    
    /**
     * @param tokenForClaiming address of claiming token
     * @param maxClaimingSpeed percent that we can claim from participant. mul by 1e6
     * @param ownerCanWithdraw if true owner can withdraw clamed tokens
     * @param ownerThrottleWithdraw period than owner can withdraw clamed tokens (if ownerCanWithdraw param set true) 
     * @param exchangeRate exchange rate claimed to native tokens. mul by 1e6

     */
    function claimingTokenAdd(
        address tokenForClaiming, 
        uint256 maxClaimingSpeed,
        bool ownerCanWithdraw,
        uint256 ownerThrottleWithdraw,
        uint256 exchangeRate
    ) 
        public 
        onlyOwner 
    {
        require(tokenForClaiming.isContract(), 'tokenForClaiming must be a contract address');
        if (tokensForClaimingMap[tokenForClaiming].exists == true) {
            // already exist
        } else {
            tokensForClaiming.push(tokenForClaiming);
            tokensForClaimingCount = tokensForClaimingCount.add(1);
            
            tokensForClaimingMap[tokenForClaiming].maxClaimingSpeed = maxClaimingSpeed;
            tokensForClaimingMap[tokenForClaiming].ownerCanWithdraw = ownerCanWithdraw; // true;
            tokensForClaimingMap[tokenForClaiming].ownerThrottleWithdraw = ownerThrottleWithdraw; // 15768000; // 60*60*24*365/2,  6 motnhs
            tokensForClaimingMap[tokenForClaiming].ownerWithdrawLast = now;
            tokensForClaimingMap[tokenForClaiming].exchangeRate = exchangeRate; // 100e4;
            tokensForClaimingMap[tokenForClaiming].exists = true;
              
            emit claimingTokenAdded(tokenForClaiming);
        }
    }
    
    /**
     * @return list list of tokens added for claiming
     */
    function claimingTokensView() public view returns (address[] memory list) {
        list = tokensForClaiming;
    }
    
    /**
     * owner can withdraw claimed tokens, if predifined option `ownerCanWithdraw` set to true
     */
    function claimingTokensWithdraw() public onlyOwner nonReentrant() {
        
        for (uint256 i = 0; i < tokensForClaimingCount; i++) {
            uint256 amount = IERC20(tokensForClaiming[i]).balanceOf(address(this));
            if (
                (amount > 0) &&
                (tokensForClaimingMap[tokensForClaiming[i]].ownerCanWithdraw == true) &&
                (now.sub(tokensForClaimingMap[tokensForClaiming[i]].ownerWithdrawLast) >= tokensForClaimingMap[tokensForClaiming[i]].ownerThrottleWithdraw )
                
            ) {
                tokensForClaimingMap[tokensForClaiming[i]].ownerWithdrawLast = now;
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
            uint256 senderBalance = IERC20(tokensForClaiming[i]).balanceOf(_msgSender());
            
            
            if (allowedAmount > 0) {
            
                require (
                    (allowedAmount.mul(1e6)).div(senderBalance) <= tokensForClaimingMap[tokensForClaiming[i]].maxClaimingSpeed,
                    'Amount exceeds available claiming rates limit.'
                );
        
                hasAllowedAmount = true;
                
                
                // get native token amount from claiming  with exchangeRate
                uint256 amount = allowedAmount.
                    mul(
                        tokensForClaimingMap[tokensForClaiming[i]].exchangeRate
                    ).
                    div(1e6);

                uint256 potentialTotal = amount.add(totalSupply());
                
                if (potentialTotal <= claimInitialMax) {
                    //allow claim without check any restrictions;
                } else {
                    require(
                        (potentialTotal < claimInitialMax.add(((now).sub(startTime)).mul(claimMorePerSeconds))), 
                        'This many tokens are not available to be claimed yet' 
                    );
                    require(
                        potentialTotal.mul(_sellExchangeRate).div(1e6) <= _reserveTokenBalance().mul(100-claimReserveMinPercent).div(100), 
                        'Amount exceeds available reserve limit' 
                    );
                    require(
                        amount.mul(_sellExchangeRate).div(1e6) <= _reserveTokenBalance().mul(claimTransactionMaxPercent).div(100),
                        'Amount exceeds transaction max percent' 
                    );
                    
                    require(
                        ((potentialTotal).mul(_sellExchangeRate).div(1e6)).sub(_reserveTokenBalance()) <= claimDeficitMax,
                        'Amount exceeds deficit max'
                    );
            
                }
               
                require(claimTransactionMaxLimit >= amount, 'Too many tokens to claim in one transaction');
                
                
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
            
            
            _receivedNativeToken(amount, senderBalanceBefore);
            _burn(address(this), amount);
        }
        
        return true;
    }
    
    function _reserveTokenBalance() internal view virtual returns(uint256) {
        // need to be implement in child
        return 0;
    }
    
    /**
     * @dev getting native tokens and send back eth(reserveToken)
     * Available only to recipient in whitelist
     * @param nativeTokensAmount native tokens amount
     * @param senderNativeTokensBalanceBefore native tokens balance sender before transfer
     */
    function _receivedNativeToken(uint256 nativeTokensAmount , uint256 senderNativeTokensBalanceBefore) internal onlyWhitelist {
       
        uint256 balanceReserveToken = _reserveTokenBalance();
        uint256 reserveTokensAmount = nativeTokensAmount .mul(sellExchangeRate()).div(1e6); // "sell exchange" interpretation with rate discount
        require ((reserveTokensAmount <= balanceReserveToken && balanceReserveToken > 0), 'Amount exceeds available balance.');
        
        require (
            (now.sub(lastObtainedReserveToken[_msgSender()]) >= 86400),
            'Available only one time in 24h.'
        );
        require (
            (nativeTokensAmount .mul(1e6)).div(senderNativeTokensBalanceBefore) <= reserveTokenLimitPerDay,
            'Amount exceeds available reserve token limit.'
        );
        
        lastObtainedReserveToken[_msgSender()] = now;

        _transferReserveToken(reserveTokensAmount);
        
    }
    
    function _transferReserveToken(uint256 amount2send) internal virtual {
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
    
    /**
     * converted reserve tokens to native tokens and mint it to sender
     * @param reserveTokenAmount reserve tokens(or eth) which will be converted to native tokens and minted it
     */
    function _mintedNativeToken(uint256 reserveTokenAmount) internal {
        uint256 nativeTokensAmount = reserveTokenAmount.mul(buyExchangeRate()).div(1e6);
        _mint(_msgSender(), nativeTokensAmount);
    } 
}



