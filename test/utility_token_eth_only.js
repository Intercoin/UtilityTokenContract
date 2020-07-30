const BN = require('bn.js'); // https://github.com/indutny/bn.js
const util = require('util');
const UtilityTokenETHOnly = artifacts.require("UtilityTokenETHOnly");
const truffleAssert = require('truffle-assertions');

contract('UtilityTokenETHOnly', (accounts) => {
    
    // Setup accounts.
    const accountOne = accounts[0];
    const accountTwo = accounts[1];  
    const accountThree = accounts[2];  

    it('should deployed correctly with correctly owner', async () => {
        const utilityTokenETHOnlyInstance = await UtilityTokenETHOnly.new('t1','t1');
        
        const owner = (await utilityTokenETHOnlyInstance.owner.call());
        assert.equal(owner, accountOne, 'owner is not accountOne');
        
    });
  
    it('should grant by owner only', async () => {
        const utilityTokenETHOnlyInstance = await UtilityTokenETHOnly.new('t1','t1');
        const currentBlockInfo = await web3.eth.getBlock("latest");
        const grantAmount = (10*10**18).toString(16);
        
        await truffleAssert.reverts(
            utilityTokenETHOnlyInstance.grant(accountTwo, '0x'+grantAmount, currentBlockInfo.number+100, false, { from: accountTwo }), 
            "Ownable: caller is not the owner."
        );
    });
    
    it('should used transferOwnership by owner only', async () => {
        const utilityTokenETHOnlyInstance = await UtilityTokenETHOnly.new('t1','t1');
      
        await truffleAssert.reverts(
            utilityTokenETHOnlyInstance.transferOwnership(accountTwo, { from: accountTwo }), 
            "Ownable: caller is not the owner."
        );
        
        await utilityTokenETHOnlyInstance.transferOwnership(accountTwo, { from: accountOne });
    });
  
    it('should grant to account', async () => {
      
        // setup
        const utilityTokenETHOnlyInstance = await UtilityTokenETHOnly.new('t1','t1');
        const currentBlockInfo = await web3.eth.getBlock("latest");
        const grantAmount = (10*10**18).toString(16);
     
         // Get initial balances of second account.
        const accountTwoStartingBalance = (await utilityTokenETHOnlyInstance.balanceOf.call(accountTwo));
        
        // Make grant from first account to second. for 100 blocks and gradual 
        await utilityTokenETHOnlyInstance.grant(accountTwo, '0x'+grantAmount, currentBlockInfo.number+100, true, { from: accountOne });
        
        // Get balances of first and second account after the transactions.
        const accountTwoEndingBalance = (await utilityTokenETHOnlyInstance.balanceOf.call(accountTwo));
    
        assert.equal(
            new BN(accountTwoEndingBalance,16).toString(16),
            (new BN(accountTwoStartingBalance,16)).add(new BN(grantAmount,16)).toString(16), 
            "Amount wasn't correctly sent to the receiver"
        );

    });    
  
    it('checking transfer limit none-gradual', async () => {
        // setup
        const utilityTokenETHOnlyInstance = await UtilityTokenETHOnly.new('t1','t1');
        const currentBlockInfo = await web3.eth.getBlock("latest");
        const grantAmount = (10*10**18).toString(16);
        const countBlocksNeedToPass = 10;
    
        // Make grant from first account to second. for 10 blocks and gradual = false
        // Note that currentBlockInfo - its block before for transaction below !!!  so plus 1 needed
        const startBlockNumber = currentBlockInfo.number+1;
        await utilityTokenETHOnlyInstance.grant(accountTwo, '0x'+grantAmount, startBlockNumber+countBlocksNeedToPass, false, { from: accountOne });
        
        // one block spent for transaction before so 
        // emulate skipping countBlocksNeedToPass-2 block
        for (let i = 0; i < countBlocksNeedToPass-2; i++) {
            await utilityTokenETHOnlyInstance.setMaxGasPrice('0x'+(1*10**18).toString(16),{ from: accountOne });    
        }
        
        // for now passed block spent countBlocksNeedToPass-1
        await truffleAssert.reverts(
            utilityTokenETHOnlyInstance.transfer(accountThree, '0x'+grantAmount, { from: accountTwo }), 
            "TransferLimit: There are no allowance tokens to transfer"
        );
        // after this block passed by 1
        await utilityTokenETHOnlyInstance.setMaxGasPrice('0x'+(1*10**18).toString(16),{ from: accountOne });    
        // and transfer have to be available for account two
        await utilityTokenETHOnlyInstance.transfer(accountThree, '0x'+grantAmount, { from: accountTwo });
        
        await truffleAssert.reverts(
            utilityTokenETHOnlyInstance.grant(accountTwo, '0x'+grantAmount, currentBlockInfo.number+100, false, { from: accountTwo }), 
            "Ownable: caller is not the owner."
        );

    });    
    
    it('checking transfer limit gradual', async () => {
        // setup
        const utilityTokenETHOnlyInstance = await UtilityTokenETHOnly.new('t1','t1');
        const currentBlockInfo = await web3.eth.getBlock("latest");
        const grantAmount = (10*10**18).toString(16);
        const countBlocksNeedToPass = 10;

        // Make grant from first account to second. for 10 blocks and gradual = true
        // Note that currentBlockInfo - its block before for transaction below !!!  so plus 1 needed
        const startBlockNumber = currentBlockInfo.number+1;
        await utilityTokenETHOnlyInstance.grant(accountTwo, '0x'+grantAmount, startBlockNumber+countBlocksNeedToPass, true, { from: accountOne });

        // one block spent for transaction before so 
        // emulate skipping countBlocksNeedToPass/2-2 block
        for (let i = 0; i < countBlocksNeedToPass/2-2; i++) {
            await utilityTokenETHOnlyInstance.setMaxGasPrice('0x'+(1*10**18).toString(16),{ from: accountOne });    
        }

        var lockupForNow = (await utilityTokenETHOnlyInstance.amountLockUp.call(accountTwo));

        var passedBloсkForNow = countBlocksNeedToPass/2-2; // 3 blocks
        var expectedLockup = (new BN(grantAmount,16))-(new BN(grantAmount,16)).div(new BN(countBlocksNeedToPass,10)).mul(new BN(passedBloсkForNow,10));
        assert.equal(
            lockupForNow.toString(16), 
            expectedLockup.toString(16), 
            "LockUp does not  equal to expected"
            );


        var lockupForNowNextBlock = (new BN(grantAmount,16))-(new BN(grantAmount,16)).div(new BN(countBlocksNeedToPass,10)).mul(new BN(passedBloсkForNow+1,10));
        // now try to transfer for 1 wei more than (grantAmount-lockupForNowNextBlock)
        await truffleAssert.reverts(
            utilityTokenETHOnlyInstance.transfer(accountThree, '0x'+(new BN(grantAmount.toString(16),16).sub(new BN(lockupForNowNextBlock.toString(16),16)).add(new BN(1,10))).toString(16), { from: accountTwo }), 
            "TransferLimit: There are no allowance tokens to transfer"
        );

        // 1 block passed by revert
        passedBloсkForNow = passedBloсkForNow + 1;
        
        // and transfer have to be available for account two
        expectedLockup = (new BN(grantAmount,16))-(new BN(grantAmount,16)).div(new BN(countBlocksNeedToPass,10)).mul(new BN(passedBloсkForNow,10));
        lockupForNow = (await utilityTokenETHOnlyInstance.amountLockUp.call(accountTwo));
        
        assert.equal(new BN(lockupForNow,16).toString(16), expectedLockup.toString(16), "LockUp does not  equal to expected");
        
        await utilityTokenETHOnlyInstance.transfer(accountThree, '0x'+((new BN(grantAmount.toString(16),16)).sub(new BN(expectedLockup.toString(16),16))).toString(16), { from: accountTwo }); 

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
        const utilityTokenETHOnlyInstance = await UtilityTokenETHOnly.new('t1','t1');
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
        const sellExchangeRate = 99;
        const buyExchangeRate = 100;
        
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
        await utilityTokenETHOnlyInstance.transfer(utilityTokenETHOnlyInstance.address, '0x'+(new BN(accountTwoTokenEndingBalance+'',10)).toString(16), { from: accountTwo });
        
        const instanceETHEndingBalance2 = (await web3.eth.getBalance(utilityTokenETHOnlyInstance.address));
        const instanceETHEndingTotalSupply2 = (await utilityTokenETHOnlyInstance.totalSupply());
         // Get initial token balances of second account.
        const accountTwoTokenEndingBalance2 = (await utilityTokenETHOnlyInstance.balanceOf.call(accountTwo));
        const accountTwoETHEndingBalance2 = (await web3.eth.getBalance(accountTwo));
        
        assert.equal(
            new BN(accountTwoTokenEndingBalance2+'',10).toString(16), 
            new BN(0+'',10).toString(16), 
            'Tokens were not transfered to contract'
        );
        
        assert.equal(
            new BN(instanceETHEndingTotalSupply2+'',10).toString(16), 
            new BN(instanceETHStartingTotalSupply+'',10).toString(16), 
            'Contract does not burn tokens'
        );
        
         assert.equal(
            (
                (
                    new BN(instanceETHEndingBalance, 10)).sub(
                        new BN(accountTwoTokenEndingBalance+'',10).mul(new BN(sellExchangeRate+'',10)).div(new BN(100+'',10))
                    )
                ).toString(16), 
            (new BN(instanceETHEndingBalance2, 10)).toString(16),
            'eth left at contract is wrong'
        );
        
    });    
 
});
