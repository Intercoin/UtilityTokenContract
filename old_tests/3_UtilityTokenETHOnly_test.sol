pragma solidity >=0.4.22 <0.7.0;
import "remix_tests.sol"; // this import is automatically injected by Remix.
import "remix_accounts.sol";

import "../UtilityTokenETHOnly.sol";
import "../CommonConstants.sol";


// File name has to end with '_test.sol', this file can contain more than one testSuite contracts
contract testUtilityToken is CommonConstants {
    
    /// Define variables referring to different accounts
    address acc0;
    address acc1;
    address acc2;
    
    UtilityTokenETHOnly meta;
    UtilityTokenETHOnly meta1;
    UtilityTokenETHOnly meta2;

    /// 'beforeAll' runs before all other tests
    /// More special functions are: 'beforeEach', 'beforeAll', 'afterEach' & 'afterAll'
    function beforeAll() public {
        acc0 = TestsAccounts.getAccount(0); 
        acc1 = TestsAccounts.getAccount(1);
        acc2 = TestsAccounts.getAccount(2);
        
        meta = new UtilityTokenETHOnly('t1','t1');
        
    }

    function checkConstantsValues() public {
        Assert.equal(DECIMALS, 10**18, "DECIMALS constant");
    }
    
    function checkGrant() public {
        // try grant
        try meta.grant(acc0,1*DECIMALS, block.number+100, true) {
            Assert.ok(true, 'Granted ok');
        } catch Error(string memory reason) {
            Assert.ok(false, reason);
        } catch (bytes memory /*lowLevelData*/) {
            Assert.ok(false, 'failed unexpected');
        }    
        Assert.equal(meta.balanceOf(acc0), 1*DECIMALS, "Check Balance after mint 1 token");
    }
    function checkGrantMoreThanAllowed() public {

        // try to grant more than allowed
        try meta.grant(acc1,1e9*DECIMALS, block.number+100, true) {
            Assert.ok(false, 'Granted more than expected');
        } catch Error(string memory reason) {
            // This is executed in case
            // revert was called inside getData
            // and a reason string was provided.
            Assert.ok(true, 'reverted');

        } catch (bytes memory /*lowLevelData*/) {
            // This is executed in case revert() was used
            // or there was a failing assertion, division
            // by zero, etc. inside getData.
            Assert.ok(false, 'failed unexpected');
        }
    }
    
    function checkGrantAvailable() public {
        meta1 = new UtilityTokenETHOnly('t1','t1');
        uint256 grantInitialMax = 1000000 * DECIMALS;
        try meta1.grant(acc1,grantInitialMax, block.number+100, true) {
            Assert.ok(true, 'Grant grantInitialMax ok');
        } catch Error(string memory reason) {
            Assert.ok(false, reason);
        } catch (bytes memory /*lowLevelData*/) {
            Assert.ok(false, 'failed unexpected');
        } 
    }
    
    
    function checkSetGasPriceAnddPassOneBlock() public {
        // try SetGasPrice
        try meta1.setMaxGasPrice(1 * DECIMALS) {
            Assert.ok(true, 'SetGasPrice ok');
        } catch Error(string memory reason) {
            Assert.ok(false, reason);
        } catch (bytes memory /*lowLevelData*/) {
            Assert.ok(false, 'failed unexpected');
        }    
    }
    
    function checkGrantGrowUp() public {
        uint256 grantMorePerBlock = 10 * DECIMALS;
        // we passed one block before 
        // and now try to grant again
        try meta1.grant(acc1,1*DECIMALS, block.number+100, true) {
            Assert.ok(true, 'Grant more grantInitialMax in allowed range -  ok');
        } catch Error(string memory reason) {
            Assert.ok(false, reason);
        } catch (bytes memory /*lowLevelData*/) {
            Assert.ok(false, 'failed unexpected');
        }  

    }
    
    function checkTransferLimit() public {
        
        meta2 = new UtilityTokenETHOnly('t1','t1');
        
        meta2.grant(acc0,1*DECIMALS, block.number+100, true);
    }


}
