pragma solidity >=0.4.22 <0.7.0;
import "remix_tests.sol"; // this import is automatically injected by Remix.
import "../Whitelist.sol";
import "remix_accounts.sol";

// File name has to end with '_test.sol', this file can contain more than one testSuite contracts
contract testWhitelist {

    Whitelist whitelistInstance;
    
    /// Define variables referring to different accounts
    address acc0;
    address acc1;
    address acc2;
    
    /// 'beforeAll' runs before all other tests
    /// More special functions are: 'beforeEach', 'beforeAll', 'afterEach' & 'afterAll'
    function beforeAll() public {
        // Here should instantiate tested contract
        whitelistInstance = new Whitelist();
        
        acc0 = TestsAccounts.getAccount(0); 
        acc1 = TestsAccounts.getAccount(1);
        acc2 = TestsAccounts.getAccount(2);
    }

    function checkSenderInList() public {
        Assert.equal(whitelistInstance.isWhitelisted(address(this)), true, 'Sender is not added to whitelist');
    }
    function checkNotExist() public {
        Assert.equal(whitelistInstance.isWhitelisted(acc1), false, 'acc1 it has not been whitelisted before');
    }    
    function checkAdd() public {
        
        address[] memory list = new address[](2);
        list[0] = acc1;
        list[1] = acc2;
        try whitelistInstance.whitelist(list) {
            Assert.ok(true, 'Adding to whitelist');
        } catch Error(string memory reason) {
            // This is executed in case
            // revert was called inside getData
            // and a reason string was provided.
            Assert.ok(false, 'Can\'t add to whitelist');
            

        } catch (bytes memory /*lowLevelData*/) {
            // This is executed in case revert() was used
            // or there was a failing assertion, division
            // by zero, etc. inside getData.
            Assert.ok(false, 'failed unexpected');
        }
        
        
        
    }
    
    function checkInWhitelistAfterAdding() public {
        Assert.equal(whitelistInstance.isWhitelisted(acc2), true, 'acc2 is not in whitelist after adding before');
    }
    
    function checkRemove() public {
        address[] memory list = new address[](2);
        list[0] = acc1;
        list[1] = acc2;
        
        // try to grant more than allowed
        try whitelistInstance.unWhitelist(list) {
            Assert.ok(true, 'removing from whitelist');
        } catch Error(string memory reason) {
            // This is executed in case
            // revert was called inside getData
            // and a reason string was provided.
            Assert.ok(false, 'Can\'t add to whitelist');
            

        } catch (bytes memory /*lowLevelData*/) {
            // This is executed in case revert() was used
            // or there was a failing assertion, division
            // by zero, etc. inside getData.
            Assert.ok(false, 'failed unexpected');
        }
    }   
    function checkInWhitelistAfterRemoving() public {
        Assert.equal(whitelistInstance.isWhitelisted(acc1), false, 'acc1 is in whitelist after removing');
    }

}
