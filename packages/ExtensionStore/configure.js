////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////
//
//           Script ExtensionStore/Configure.js v_1.01
//
//     Extension store that scrubs a list of github accounts
//     and allows easy installation/uninstallation/updates.
//
//     written by Mathieu Chaptel m.chaptel@gmail.com
//
//   This store is made available under the Mozilla Public license 2.0.
//   https://www.mozilla.org/en-US/MPL/2.0/
//
////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////

MessageLog.trace("Succesfully loaded Extension Store Package.");


function configure(packageFolder, packageName) {
  ScriptManager.addView({
    id: "Extension Store",
    text: "Extension Store",
    action: "initStoreUI in ./configure.js"
  })
}


function initStoreUI() {
  var StoreUI = require("./storeui.js").StoreUI;
  var ui = new StoreUI();
  ui.show();
}

exports.configure = configure