
const UtilityTokenETHOnly = artifacts.require("UtilityTokenETHOnly");
const UtilityTokenETHOnlyMock = artifacts.require("UtilityTokenETHOnlyMock");

const UtilityToken = artifacts.require("UtilityToken");
const UtilityTokenMock = artifacts.require("UtilityTokenMock");

const ERC20Mintable = artifacts.require("ERC20Mintable");
const ERC20Mintable2 = artifacts.require("ERC20Mintable");

module.exports = function(deployer) {
  deployer.deploy(UtilityTokenETHOnly,'t1','t1');
  deployer.deploy(UtilityTokenETHOnlyMock,'t1','t1');
  deployer.deploy(ERC20Mintable,'t2','t2');
  
//   deployer.deploy(UtilityToken,'t3','t3',"0x0000000000000000000000000000000000000000");
//   deployer.deploy(UtilityTokenMock,'t4','t4',"0x0000000000000000000000000000000000000000");
  deployer.deploy(ERC20Mintable2,'t5','t5');
  
};
