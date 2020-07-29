
const UtilityTokenETHOnly = artifacts.require("UtilityTokenETHOnly");

module.exports = function(deployer) {
  deployer.deploy(UtilityTokenETHOnly,'t1','t1');
};
