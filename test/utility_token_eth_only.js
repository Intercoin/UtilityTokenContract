const BN = require('bn.js'); // https://github.com/indutny/bn.js
const BigNumber = require('bignumber.js');
const util = require('util');
const UtilityTokenETHOnly = artifacts.require("UtilityTokenETHOnly");
const UtilityTokenETHOnlyMock = artifacts.require("UtilityTokenETHOnlyMock");
const ERC20MintableToken = artifacts.require("ERC20Mintable");
const UtilityTokenETHOnlyFactory = artifacts.require("UtilityTokenETHOnlyFactory");
const truffleAssert = require('truffle-assertions');
const helper = require("../helpers/truffleTestHelper");

contract('UtilityTokenETHOnly', (accounts) => {
    
    // Setup accounts.
    const accountOne = accounts[0];
    const accountTwo = accounts[1];  
    const accountThree = accounts[2];  
    const maxClaimingSpeed = 500000; //50e4
    const maxClaimingFrequency = 86400; //1day;
    const ownerCanWithdraw = true;
    const ownerThrottleWithdraw = 15768000; // 60*60*24*365/2,  6 motnhs;
    const exchangeRate = 1000000; //100e4

    it('should deployed correctly with correctly owner', async () => {
        const utilityTokenETHOnlyInstance = await UtilityTokenETHOnly.new('t1','t1');
        
        const owner = (await utilityTokenETHOnlyInstance.owner.call());
        assert.equal(owner, accountOne, 'owner is not accountOne');
        
    });
    
    it('should used transferOwnership by owner only', async () => {
        const utilityTokenETHOnlyInstance = await UtilityTokenETHOnly.new('t1','t1');
      
        await truffleAssert.reverts(
            utilityTokenETHOnlyInstance.transferOwnership(accountTwo, { from: accountTwo }), 
            "Ownable: caller is not the owner."
        );
        
        await utilityTokenETHOnlyInstance.transferOwnership(accountTwo, { from: accountOne });
    });

    it('should add address TokenForClaiming to list', async () => {
        const utilityTokenETHOnlyInstance = await UtilityTokenETHOnly.new('t1','t1');
        const ERC20MintableTokenInstance = await ERC20MintableToken.new('t2','t2');
        
        await truffleAssert.reverts(
            utilityTokenETHOnlyInstance.claimingTokenAdd(ERC20MintableTokenInstance.address, maxClaimingSpeed, maxClaimingFrequency, ownerCanWithdraw, ownerThrottleWithdraw, exchangeRate, { from: accountTwo }), 
            "Ownable: caller is not the owner."
        );
        
        await truffleAssert.reverts(
            utilityTokenETHOnlyInstance.claimingTokenAdd(accountThree, maxClaimingSpeed, maxClaimingFrequency, ownerCanWithdraw, ownerThrottleWithdraw, exchangeRate, { from: accountOne }), 
            "tokenForClaiming must be a contract address"
        );
        // add to claim list
        await utilityTokenETHOnlyInstance.claimingTokenAdd(ERC20MintableTokenInstance.address, maxClaimingSpeed, maxClaimingFrequency, ownerCanWithdraw, ownerThrottleWithdraw, exchangeRate, { from: accountOne });
        
        let list = (await utilityTokenETHOnlyInstance.claimingTokensView({ from: accountOne }));
        
        assert.notEqual(
            list.indexOf(ERC20MintableTokenInstance.address),
            -1,
            "TokenForClaiming does not added in list as expected");
    });

    it('should revert claim if it wasn\'t approve tokens before', async () => {
        // setup
        const utilityTokenETHOnlyInstance = await UtilityTokenETHOnly.new('t1','t1');
        const ERC20MintableTokenInstance = await ERC20MintableToken.new('t2','t2');
        
        const grantAmount = (10*10**18).toString(16);
        
        // add to claim list
        await utilityTokenETHOnlyInstance.claimingTokenAdd(ERC20MintableTokenInstance.address, maxClaimingSpeed, maxClaimingFrequency, ownerCanWithdraw, ownerThrottleWithdraw, exchangeRate, { from: accountOne });
        
        // mint to ERC20MintableToken
        await ERC20MintableTokenInstance.mint(accountTwo, '0x'+grantAmount, { from: accountOne });
        
        //
        await truffleAssert.reverts(
            utilityTokenETHOnlyInstance.claim({ from: accountTwo }), 
            "Amount exceeds allowed balance"
        );
    });
    
    it('should revert claim if it wasn\'t added TokenForClaiming before', async () => {
        // setup
        const utilityTokenETHOnlyInstance = await UtilityTokenETHOnly.new('t1','t1');
        const ERC20MintableTokenInstance = await ERC20MintableToken.new('t2','t2');
        
        const grantAmount = (10*10**18).toString(16);
        
        // mint to ERC20MintableToken
        await ERC20MintableTokenInstance.mint(accountTwo, '0x'+grantAmount, { from: accountOne });
        
        //make approve
        await ERC20MintableTokenInstance.approve(utilityTokenETHOnlyInstance.address, '0x'+grantAmount, { from: accountTwo });
        
        //
        await truffleAssert.reverts(
            utilityTokenETHOnlyInstance.claim({ from: accountTwo }), 
            "There are no allowed tokens for claiming"
        );
        
    });

    it('should claim to account', async () => {
      
        // setup
        const utilityTokenETHOnlyInstance = await UtilityTokenETHOnly.new('t1','t1');
        const ERC20MintableTokenInstance = await ERC20MintableToken.new('t2','t2');
        const currentBlockInfo = await web3.eth.getBlock("latest");
        const grantAmount = (10*10**18).toString(16);
        const claimCorrectRateAmount = (5*10**18).toString(16);
     
         // Get initial balances of second account.
        const accountTwoStartingBalance = (await utilityTokenETHOnlyInstance.balanceOf.call(accountTwo));
        
         // add to claim list
        await utilityTokenETHOnlyInstance.claimingTokenAdd(ERC20MintableTokenInstance.address, maxClaimingSpeed, maxClaimingFrequency, ownerCanWithdraw, ownerThrottleWithdraw, exchangeRate, { from: accountOne });
        
        // mint to ERC20MintableToken
        await ERC20MintableTokenInstance.mint(accountTwo, '0x'+grantAmount, { from: accountOne });
        
        //make approve with exceed rate
        await ERC20MintableTokenInstance.approve(utilityTokenETHOnlyInstance.address, '0x'+grantAmount, { from: accountTwo });

        // claim()
        await truffleAssert.reverts(
            utilityTokenETHOnlyInstance.claim({ from: accountTwo }), 
            "Amount exceeds available claiming rates limit."
        );
        
        // now approve correctly
        await ERC20MintableTokenInstance.approve(utilityTokenETHOnlyInstance.address, '0x'+claimCorrectRateAmount, { from: accountTwo });

        // claim()
        await utilityTokenETHOnlyInstance.claim({ from: accountTwo });
        
        ///////////////
        
        // Get balances of first and second account after the transactions.
        const accountTwoEndingBalance = (await utilityTokenETHOnlyInstance.balanceOf.call(accountTwo));

        assert.equal(
            new BN(accountTwoEndingBalance,16).toString(16),
            (new BN(accountTwoStartingBalance,16)).add(new BN(claimCorrectRateAmount,16)).toString(16), 
            "Amount wasn't correctly sent to the receiver"
        );

    });    
 
    it('should add/remove to/from whitelist ', async () => {
        const utilityTokenETHOnlyInstance = await UtilityTokenETHOnly.new('t1','t1');
        var existAccountTwoInWhitelist,existAccountThreeInWhitelist;
        
        // add accountTwo and check
        await utilityTokenETHOnlyInstance.whitelistAdd([accountTwo], { from: accountOne });
        existAccountTwoInWhitelist = (await utilityTokenETHOnlyInstance.isWhitelisted.call(accountTwo));
        assert.equal(existAccountTwoInWhitelist, true, "Account was not added in whitelist");
        
        // remove accountTwo after adding before  and check
        await utilityTokenETHOnlyInstance.whitelistRemove([accountTwo], { from: accountOne });
        existAccountTwoInWhitelist = (await utilityTokenETHOnlyInstance.isWhitelisted.call(accountTwo));
        assert.notEqual(existAccountTwoInWhitelist, true, "Account was not removed in whitelist");
        
        // adding batch accountTwo and accountThree  and check
        await utilityTokenETHOnlyInstance.whitelistAdd([accountTwo,accountThree], { from: accountOne });
        existAccountTwoInWhitelist = (await utilityTokenETHOnlyInstance.isWhitelisted.call(accountTwo));
        existAccountThreeInWhitelist = (await utilityTokenETHOnlyInstance.isWhitelisted.call(accountThree));
        assert.equal(existAccountTwoInWhitelist && existAccountThreeInWhitelist, true, "Accounts were not added in whitelist");
        
        await utilityTokenETHOnlyInstance.whitelistRemove([accountTwo,accountThree], { from: accountOne });
        existAccountTwoInWhitelist = (await utilityTokenETHOnlyInstance.isWhitelisted.call(accountTwo));
        existAccountThreeInWhitelist = (await utilityTokenETHOnlyInstance.isWhitelisted.call(accountThree));
        assert.notEqual(existAccountTwoInWhitelist && existAccountThreeInWhitelist, true, "Accounts were not added in whitelist");
        
    });
    
    it('should add/remove to/from whitelist by owner only', async () => {
        const utilityTokenETHOnlyInstance = await UtilityTokenETHOnly.new('t1','t1');
        
        await truffleAssert.reverts(
            utilityTokenETHOnlyInstance.whitelistAdd([accountTwo], { from: accountTwo }), 
            "Ownable: caller is not the owner."
        );
        
        await truffleAssert.reverts(
            utilityTokenETHOnlyInstance.whitelistRemove([accountTwo], { from: accountThree }), 
            "Ownable: caller is not the owner."
        );
        
    });
    
    it('should exchange Token/ETH', async () => {
        const utilityTokenETHOnlyInstance = await UtilityTokenETHOnlyMock.new('t1','t1');
        const amountETHSendToContract = 10*10**18; // 10ETH
        
        
        const instanceETHStartingBalance = (await web3.eth.getBalance(utilityTokenETHOnlyInstance.address));
        const instanceETHStartingTotalSupply = (await utilityTokenETHOnlyInstance.totalSupply());
         // Get initial token balances of second account.
        const accountTwoTokenStartingBalance = (await utilityTokenETHOnlyInstance.balanceOf.call(accountTwo));
        const accountTwoETHStartingBalance = (await web3.eth.getBalance(accountTwo));
        
        // send ETH to Contract
        await web3.eth.sendTransaction({
            from:accountTwo,
            to: utilityTokenETHOnlyInstance.address, 
            value: amountETHSendToContract
            
        });
        
        const instanceETHEndingBalance = (await web3.eth.getBalance(utilityTokenETHOnlyInstance.address));
        const instanceETHEndingTotalSupply = (await utilityTokenETHOnlyInstance.totalSupply());
         // Get initial token balances of second account.
        const accountTwoTokenEndingBalance = (await utilityTokenETHOnlyInstance.balanceOf.call(accountTwo));
        const accountTwoETHEndingBalance = (await web3.eth.getBalance(accountTwo));
        
        assert.equal(
            (new BN(instanceETHStartingBalance+'',10).add(new BN(amountETHSendToContract+'',10))).toString(16), 
            (new BN(instanceETHEndingBalance, 10)).toString(16),
            'Сontract does not receive eth'
        );
        let sellExchangeRate = await utilityTokenETHOnlyInstance.getSellExchangeRate();
        let buyExchangeRate = await utilityTokenETHOnlyInstance.getBuyExchangeRate();
        sellExchangeRate = ((new BN(sellExchangeRate+'',10)).div(new BN(10000+'',10))).toString(10);
        buyExchangeRate = ((new BN(buyExchangeRate+'',10)).div(new BN(10000+'',10))).toString(10);

        assert.equal(
            (new BN(amountETHSendToContract+'',10).mul(new BN(buyExchangeRate+'',10)).div(new BN(100+'',10))).toString(16), 
            (new BN(accountTwoTokenEndingBalance, 10)).toString(16),
            'Token\'s count are wrong'
        );
        
        await truffleAssert.reverts(
            utilityTokenETHOnlyInstance.transfer(utilityTokenETHOnlyInstance.address, '0x'+(new BN(accountTwoTokenEndingBalance+'',10)).toString(16), { from: accountTwo }), 
            "Sender is not in whitelist"
        );
        
        await utilityTokenETHOnlyInstance.whitelistAdd([accountTwo], { from: accountOne });
        
        // try again send token back to contract 
        // await utilityTokenETHOnlyInstance.transfer(utilityTokenETHOnlyInstance.address, '0x'+(new BN(accountTwoTokenEndingBalance+'',10)).toString(16), { from: accountTwo });
        await truffleAssert.reverts(
            utilityTokenETHOnlyInstance.transfer(utilityTokenETHOnlyInstance.address, '0x'+(new BN(accountTwoTokenEndingBalance+'',10)).toString(16), { from: accountTwo }), 
            "Amount exceeds available reserve token limit."
        );
        
        let reserveTokenLimitPerDay = await utilityTokenETHOnlyInstance.getReserveTokenLimitPerDay();
        
        let token2Transfer =  BigNumber(parseInt(accountTwoTokenEndingBalance)).times(BigNumber(reserveTokenLimitPerDay)).div(BigNumber(1e6))
        
        await utilityTokenETHOnlyInstance.transfer(utilityTokenETHOnlyInstance.address, '0x'+(new BN(token2Transfer+'',10)).toString(16), { from: accountTwo });
        
        await truffleAssert.reverts(
            utilityTokenETHOnlyInstance.transfer(utilityTokenETHOnlyInstance.address, '0x'+(new BN(token2Transfer+'',10)).toString(16), { from: accountTwo }), 
            "Available only one time in 24h."
        );
        
        const instanceETHEndingBalance2 = (await web3.eth.getBalance(utilityTokenETHOnlyInstance.address));
        const instanceETHEndingTotalSupply2 = (await utilityTokenETHOnlyInstance.totalSupply());
         // Get initial token balances of second account.
        const accountTwoTokenEndingBalance2 = (await utilityTokenETHOnlyInstance.balanceOf.call(accountTwo));
        const accountTwoETHEndingBalance2 = (await web3.eth.getBalance(accountTwo));
        
        assert.equal(
            (
                BigNumber(parseInt(accountTwoTokenEndingBalance2))
            ).toString(), 
            (
                BigNumber(parseInt(accountTwoTokenEndingBalance)).minus(BigNumber(token2Transfer))
            ).toString(), 
            'Tokens were not transfered to contract'
        );

        assert.equal(
            
            (
                BigNumber(parseInt(instanceETHEndingTotalSupply2))
            ).toString(), 
            (
                BigNumber(parseInt(instanceETHEndingTotalSupply)).minus(BigNumber(token2Transfer))
            ).toString(), 
            
            'Contract does not burn tokens'
        );
        
         assert.equal(
            (
                (
                    new BN(instanceETHEndingBalance, 10)).sub(
                        new BN(token2Transfer+'',10).mul(new BN(sellExchangeRate+'',10)).div(new BN(100+'',10))
                    )
                ).toString(16), 
            (new BN(instanceETHEndingBalance2, 10)).toString(16),
            'eth left at contract is wrong'
        );
        
    });    

    it('checks claim restrictions', async () => {
        // setup
        const utilityTokenETHOnlyInstance = await UtilityTokenETHOnlyMock.new('t1','t1');
        const ERC20MintableTokenInstance = await ERC20MintableToken.new('t2','t2');
        const currentBlockInfo = await web3.eth.getBlock("latest");
        
        let tmpClaimsParams = await utilityTokenETHOnlyInstance.getClaimsParams();
        let claimInitialMax = tmpClaimsParams[0];
        let claimMorePerSeconds = tmpClaimsParams[1];
        let claimReserveMinPercent = tmpClaimsParams[2];
        let claimMaxPercent = tmpClaimsParams[3];
        let claimDeficitMax = tmpClaimsParams[4];
        let claimMaxLimit = tmpClaimsParams[5];
        
        claimInitialMax = BigNumber(1000).times(BigNumber(1e18));
        await utilityTokenETHOnlyInstance.setClaimsParams('0x'+claimInitialMax.toString(16),claimMorePerSeconds,claimReserveMinPercent,claimMaxPercent,claimDeficitMax,claimMaxLimit);

        let grantAmount = (
            BigNumber(claimInitialMax).div(BigNumber(maxClaimingSpeed)).times(1e6)
        ).toString(16);
        let claimCorrectRateAmount = (claimInitialMax).toString(16);
     
         // Get initial balances of second account.
        const accountTwoStartingBalance = (await utilityTokenETHOnlyInstance.balanceOf.call(accountTwo));

         // add to claim list
        await utilityTokenETHOnlyInstance.claimingTokenAdd(ERC20MintableTokenInstance.address, maxClaimingSpeed, maxClaimingFrequency, ownerCanWithdraw, ownerThrottleWithdraw, exchangeRate, {from: accountOne });
        
        // mint to ERC20MintableToken
        await ERC20MintableTokenInstance.mint(accountTwo, '0x'+grantAmount, { from: accountOne });
        
        // now approve
        await ERC20MintableTokenInstance.approve(utilityTokenETHOnlyInstance.address, '0x'+claimCorrectRateAmount, { from: accountTwo });

        // claim()
        await utilityTokenETHOnlyInstance.claim({ from: accountTwo });

        let availableToClaimFor10sec = BigNumber(claimMorePerSeconds).times(BigNumber(10));
        
        // pass 5 seconds
        advanceTimeAndBlock(5);
        
        await ERC20MintableTokenInstance.approve(utilityTokenETHOnlyInstance.address, '0x'+availableToClaimFor10sec.toString(16), {from: accountTwo });
        await truffleAssert.reverts(
            utilityTokenETHOnlyInstance.claim({ from: accountTwo }), 
            "This many tokens are not available to be claimed yet"
        );

        // pass another 5 seconds
        advanceTimeAndBlock(5);
        await truffleAssert.reverts(
            utilityTokenETHOnlyInstance.claim({ from: accountTwo }), 
            "Amount exceeds available reserve limit"
        );
        
        
        
        // send ETH to Contract
        // await web3.eth.sendTransaction({
        //     from:accountTwo,
        //     to: utilityTokenETHOnlyInstance.address, 
        //     value: '0x'+BigNumber(30e18).toString(16)
            
        // });
        //await utilityTokenETHOnlyInstance.donateETH({from: accountTwo, value: '0x'+BigNumber(30e18).toString(16)})
        
        
        // pass 24h
        // advanceTimeAndBlock(86400);
        // await ERC20MintableTokenInstance.approve(utilityTokenETHOnlyInstance.address, '0x'+BigNumber(5e18).toString(16), {from: accountTwo });
        // await truffleAssert.reverts(
        //     utilityTokenETHOnlyInstance.claim({from: accountTwo }), 
        //     "Amount exceeds transaction max percent"
        // );
        
    });
    
    it('simple workflow', async () => {
        // 1. Someone deployes ITRF contract
        // 2. ITR holders show up and try to claim some ITRF with claimInitialMax, they have lockup for a while
        // 3. Then first buyers come and buy ITRF with ETH
        // 4. People who have ITRF transfer it back to contract and get that amount * sellExchangRate of ETH
        // 5. But after claimInitialMax, new attempts to put ITRF will require there to be enough reserves of ETH, etc.

        // setup
        // 1. Someone deployes ITRF contract
        const utilityTokenETHOnlyInstance = await UtilityTokenETHOnlyMock.new('t1','t1');
        // ----
        const ERC20MintableTokenInstance = await ERC20MintableToken.new('t2','t2');
        const currentBlockInfo = await web3.eth.getBlock("latest");
        const amountETHSendToContract = 10*10**18; // 10ETH
        
        
        let tmpClaimsParams = await utilityTokenETHOnlyInstance.getClaimsParams();
        let claimInitialMax = tmpClaimsParams[0];
        let claimMorePerSeconds = tmpClaimsParams[1];
        let claimReserveMinPercent = tmpClaimsParams[2];
        let claimMaxPercent = tmpClaimsParams[3];
        let claimDeficitMax = tmpClaimsParams[4];
        let claimMaxLimit = tmpClaimsParams[5];
        
         // setup ITR token as claiming
        await utilityTokenETHOnlyInstance.claimingTokenAdd(ERC20MintableTokenInstance.address, maxClaimingSpeed, maxClaimingFrequency, ownerCanWithdraw, ownerThrottleWithdraw, exchangeRate, {from: accountOne });
        
        claimInitialMax = BigNumber(1000).times(BigNumber(1e18));
        await utilityTokenETHOnlyInstance.setClaimsParams('0x'+claimInitialMax.toString(16),claimMorePerSeconds,claimReserveMinPercent,claimMaxPercent,claimDeficitMax,claimMaxLimit);

        let grantAmount = (
            BigNumber(claimInitialMax).div(BigNumber(maxClaimingSpeed)).times(1e6)
        ).toString(16);
        let claimCorrectRateAmount = (claimInitialMax).toString(16);
        
        // mint to ERC20MintableToken
        await ERC20MintableTokenInstance.mint(accountTwo, '0x'+grantAmount, { from: accountOne });
        
        // now approve
        await ERC20MintableTokenInstance.approve(utilityTokenETHOnlyInstance.address, '0x'+claimCorrectRateAmount, { from: accountTwo });
        
        // 2. ITR holders show up and try to claim some ITRF with claimInitialMax, they have lockup for a while
        await utilityTokenETHOnlyInstance.claim({ from: accountTwo });
        
        let availableToClaimFor10sec = BigNumber(claimMorePerSeconds).times(BigNumber(10));
        // pass 5 seconds
        advanceTimeAndBlock(5);
        
        const accountThreeStartingBalance = (await utilityTokenETHOnlyInstance.balanceOf.call(accountThree));
        // 3. Then first buyers come and buy ITRF with ETH
        await web3.eth.sendTransaction({
            from:accountThree,
            to: utilityTokenETHOnlyInstance.address, 
            value: amountETHSendToContract
            
        });
        const accountThreeEndingBalance = (await utilityTokenETHOnlyInstance.balanceOf.call(accountThree));
        
        // 4. People who have ITRF transfer it back to contract and get that amount * sellExchangRate of ETH
        await utilityTokenETHOnlyInstance.whitelistAdd([accountThree], { from: accountOne });
        await truffleAssert.reverts(
            utilityTokenETHOnlyInstance.transfer(utilityTokenETHOnlyInstance.address, '0x'+(BigNumber(accountThreeEndingBalance).minus(BigNumber(accountThreeStartingBalance))).toString(16), { from: accountThree }),
            'Amount exceeds available reserve token limit.'
        );
        
        // 5. But after claimInitialMax, new attempts to put ITRF will require there to be enough reserves of ETH, etc.
        await ERC20MintableTokenInstance.approve(utilityTokenETHOnlyInstance.address, '0x'+availableToClaimFor10sec.toString(16), {from: accountTwo });
        await truffleAssert.reverts(
            utilityTokenETHOnlyInstance.claim({ from: accountTwo }), 
            "This many tokens are not available to be claimed yet"
        );

    });
    
    it('checks claim restrictions', async () => {
        // setup
        const utilityTokenETHOnlyInstance = await UtilityTokenETHOnlyMock.new('t1','t1');
        const ERC20MintableTokenInstance = await ERC20MintableToken.new('t2','t2');
        const currentBlockInfo = await web3.eth.getBlock("latest");
        
        let tmpClaimsParams = await utilityTokenETHOnlyInstance.getClaimsParams();
        let claimInitialMax = tmpClaimsParams[0];
        let claimMorePerSeconds = tmpClaimsParams[1];
        let claimReserveMinPercent = tmpClaimsParams[2];
        let claimMaxPercent = tmpClaimsParams[3];
        let claimDeficitMax = tmpClaimsParams[4];
        let claimMaxLimit = tmpClaimsParams[5];
        
        claimInitialMax = BigNumber(1000).times(BigNumber(1e18));
        await utilityTokenETHOnlyInstance.setClaimsParams('0x'+claimInitialMax.toString(16),claimMorePerSeconds,claimReserveMinPercent,claimMaxPercent,claimDeficitMax,claimMaxLimit);

        let grantAmount = (
            BigNumber(claimInitialMax).div(BigNumber(maxClaimingSpeed)).times(1e6)
        ).toString(16);
        let claimCorrectRateAmount = (claimInitialMax).toString(16);
     
         // Get initial balances of second account.
        const accountTwoStartingBalance = (await utilityTokenETHOnlyInstance.balanceOf.call(accountTwo));

         // add to claim list
        await utilityTokenETHOnlyInstance.claimingTokenAdd(ERC20MintableTokenInstance.address, maxClaimingSpeed, maxClaimingFrequency, ownerCanWithdraw, ownerThrottleWithdraw, exchangeRate, {from: accountOne });
        
        // mint to ERC20MintableToken
        await ERC20MintableTokenInstance.mint(accountTwo, '0x'+grantAmount, { from: accountOne });
        
        // now approve
        await ERC20MintableTokenInstance.approve(utilityTokenETHOnlyInstance.address, '0x'+(BigNumber(claimInitialMax).div(BigNumber(100))).toString(16), { from: accountTwo });
        // claim()
        await utilityTokenETHOnlyInstance.claim({ from: accountTwo });
        
        await ERC20MintableTokenInstance.approve(utilityTokenETHOnlyInstance.address, '0x'+(BigNumber(claimInitialMax).div(BigNumber(100))).toString(16), { from: accountTwo });
        await truffleAssert.reverts(
            utilityTokenETHOnlyInstance.claim({ from: accountTwo }),
            "Claim  are to fast"
        );
    });
});
