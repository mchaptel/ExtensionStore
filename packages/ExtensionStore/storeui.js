var storelib = require("./github_scrubber.js");

var log = new storelib.Logger("UI")


/**
 * The main extension store widget class
 */
function StoreUI(){
  this.store = new storelib.Store();
  this.log = new storelib.Logger("StoreUI");
  log.debug("loading UI")

  // the list of installed extensions
  this.localList = new storelib.LocalExtensionList(this.store);

  // the extension representing the store on the remote repository
  this.storeExtension = this.store.storeExtension;

  // setting up UI ---------------------------------------------------
  var packageView = ScriptManager.getView("Extension Store");
  this.ui = ScriptManager.loadViewUI(packageView, "./store.ui");
  this.ui.minimumWidth = UiLoader.dpiScale(350);
  this.ui.minimumHeight = UiLoader.dpiScale(200);

  // create shorthand references to some of the main widgets of the ui
  this.storeFrame = this.ui.storeFrame;
  this.aboutFrame = this.ui.aboutFrame;
  this.storeListPanel = this.storeFrame.storeSplitter.widget(0);
  this.storeDescriptionPanel = this.storeFrame.storeSplitter.widget(1);
  this.extensionsList = this.storeListPanel.extensionsList;

  // disable store frame until store is loaded
  this.storeFrame.hide();

  var logo = storelib.currentFolder+"/logo.png"
  var logoPixmap = new QPixmap(logo);
  this.aboutFrame.storeLabel.setPixmap(logoPixmap)

  this.checkForUpdates()

  // connect UI signals
  this.aboutFrame.loadStoreButton.clicked.connect(this, this.loadStore)

  // filter the store list --------------------------------------------
  this.storeFrame.searchStore.textChanged.connect(this, this.updateExtensionsList)

  // filter by installed only -----------------------------------------
  this.storeFrame.showInstalledCheckbox.toggled.connect(this, this.updateExtensionsList)

  // Clear search button ----------------------------------------------
  UiLoader.setSvgIcon(this.storeFrame.storeClearSearch, specialFolders.resource + "/icons/old/edit_delete.png");
  this.storeFrame.storeClearSearch.clicked.connect(this, function () {
    this.storeFrame.searchStore.text = "";
  })

  // update and display the description panel when selection changes --
  this.extensionsList.itemSelectionChanged.connect(this, this.toggleDescriptionPanel)

  // View Source button -----------------------------------------------
  this.storeDescriptionPanel.sourceButton.clicked.connect(this, function () {
    QDesktopServices.openUrl(new QUrl(this.storeDescriptionPanel.sourceButton.toolTip));
  });

  // View Website Button ----------------------------------------------
  this.storeDescriptionPanel.websiteButton.clicked.connect(this, function () {
    QDesktopServices.openUrl(new QUrl(this.storeDescriptionPanel.websiteButton.toolTip));
  });

  this.storeFrame.registerButton.clicked.connect(this, this.registerExtension);

  // Install Button Actions -------------------------------------------
  this.installAction = new QAction("Install", this);
  this.installAction.triggered.connect(this, this.performInstall);

  this.updateAction = new QAction("Update", this);
  this.updateAction.triggered.connect(this, this.performInstall);

  this.uninstallAction = new QAction("Uninstall", this);
  this.uninstallAction.triggered.connect(this, this.performUninstall);
}

/**
 * Brings up the register extension dialog for script makers
 */
StoreUI.prototype.registerExtension = function(){
  var RegisterExtensionDialog = require("./register.js").RegisterExtensionDialog;
  var registerDialog = new RegisterExtensionDialog(this.store, this.localList);
  registerDialog.show();
}


StoreUI.prototype.show = function(){
  this.ui.show()
}


/**
 * Loads the store
 */
StoreUI.prototype.loadStore = function(){
  this.storeFrame.show();
  this.aboutFrame.hide();

  // setup the store widget sizes
  this.extensionsList.setColumnWidth(0, UiLoader.dpiScale(220));
  this.extensionsList.setColumnWidth(1, UiLoader.dpiScale(30));

  // setup the scrollArea containing the webview
  this.descriptionText = new DescriptionView()
  var webWidget = this.storeDescriptionPanel.webContent;
  webWidget.setLayout(new QVBoxLayout());
  webWidget.layout().setContentsMargins(0, 0, 0, 0);
  webWidget.layout().addWidget(this.descriptionText, 0, Qt.AlignTop);

  // set default expanded size to half the splitter size
  var storeFrame = this.storeFrame;
  storeFrame.storeSplitter.setSizes([storeFrame.width / 2, storeFrame.width / 2]);
  this.storeFrameState = storeFrame.storeSplitter.saveState();
  storeFrame.storeSplitter.setSizes([storeFrame.storeSplitter.width, 0]);

  // expensive loading operation, maybe we could show a progress bar here somehow
  // (instead of doing it one line, do it seller by seller then extension by extension and update progress?)
  var extensions = this.store.extensions;

  // saving the list of extensions so we can pinpoint the new ones at next startup and highlight them
  var oldExtensions = this.localList.getData("extensions", [])
  var newExtensions = this.localList.getData("newExtensions", [])
  oldExtensions = oldExtensions.concat(newExtensions); // saving the new extensions from last time as old
  newExtensions = [];

  for (var i in extensions) {
    if (oldExtensions.indexOf(extensions[i].id) == -1) newExtensions.push(extensions[i].id);
  }

  this.localList.saveData("extensions", oldExtensions);
  this.localList.saveData("newExtensions", newExtensions);

  this.updateExtensionsList();
}



/**
 * Looks for the version in the local list, first by id, then by name in case ID changed.
 * @returns {string}  the current version of the installed store
 */
StoreUI.prototype.getInstalledVersion = function(){
  if (this.localList.list.length > 0) {
    if (this.localList.hasOwnProperty(this.storeExtension.id)){
      var installedStore = this.localList.extensions[this.storeExtension.id];
    }else{
      // in case id changed (repo changed), we search by name
      for (var i in this.localList.extensions){
        if (this.localList.extensions[i].name == this.storeExtension.name){
          var installedStore = this.localList.extensions[i];
          break;
        }
      }
    }

    var currentVersion = installedStore.version;
  }else{
    // in case of missing list file, we find out the current version by parsing the json ?
    var json = this.store.localPackage;
    if (!json) throw new Error("Invalid store tbpackage.json")

    var currentVersion = json.version;
  }

  return currentVersion;
}


/**
 * Checks for a new version and updates the ribbon accordingly
 */
StoreUI.prototype.checkForUpdates = function(){
  var updateRibbon = this.aboutFrame.updateRibbon

  noConnexionRibbonStyleSheet = "QWidget { background-color: darkRed; color: white; }";
  updateRibbonStyleSheet = "QWidget { background-color: blue; }";
  var storeUi = this;

  try{
    var storeExtension = this.storeExtension;
    var storeVersion = storeExtension.version;
    var currentVersion = this.getInstalledVersion();

    // if a more recent version of the store exists on the repo, activate the update ribbon
    if (!storeExtension.currentVersionIsOlder(currentVersion) && (currentVersion != storeVersion)) {
      updateRibbon.storeVersion.setText("v" + currentVersion + "  ⓘ New version available: v" + storeVersion);
      updateRibbon.setStyleSheet(updateRibbonStyleSheet);
      updateRibbon.updateButton.toolTip = storeExtension.package.description;
      updateRibbon.updateButton.clicked.connect(this, function(){storeUi.updateStore(currentVersion, storeVersion)});
    } else {
      updateRibbon.updateButton.hide();
      updateRibbon.storeVersion.setText("v" + currentVersion + " ✓ - Store is up to date.");
      this.storeFrame.storeVersionLabel.setText("v" + currentVersion );
    }

  }catch(err){
    // couldn't check updates, probably we don't have an internet access.
    // We set up an error message and disable load button.
    log.error(err)
    this.aboutFrame.loadStoreButton.enabled = false;
    updateRibbon.updateButton.hide();
    updateRibbon.setStyleSheet(noConnexionRibbonStyleSheet);
    updateRibbon.storeVersion.setText("Could not connect to GitHub. Store disabled, check internet access.");
  }
}


/**
 * installs the version of the store found on the repo.
 */
StoreUI.prototype.updateStore = function(currentVersion, storeVersion){
  var success = this.localList.install(this.storeExtension);
  if (success) {
    MessageBox.information("Store succesfully updated to version v" + storeVersion + ".\n\nPlease restart Harmony for changes to take effect.");
    this.aboutFrame.updateRibbon.storeVersion.setText("v" + currentVersion);
    this.aboutFrame.updateRibbon.setStyleSheet("");
    this.aboutFrame.updateRibbon.updateButton.hide();
  } else {
    MessageBox.information("There was a problem updating to v" + storeVersion + ".\n\n The update was not successful.");
  }
}


/**
 * Updates the list widget displaying the extensions
 */
StoreUI.prototype.updateExtensionsList = function(){
  if (this.localList.list.length == 0) this.localList.createListFile(this.store);

  function nameSort(a, b){
    return a.name.toLowerCase() < b.name.toLowerCase()?-1:1
  }

  var filter = this.storeFrame.searchStore.text;
  var sellers = this.store.sellers;
  // sort sellers alphabetically
  sellers.sort(nameSort)

  // save selection
  if (this.extensionsList.selectedItems().length > 0) {
    var currentSelectionId = this.extensionsList.selectedItems()[0].data(0, Qt.UserRole);
  }

  //remove all widgets from store
  for (var i = this.extensionsList.topLevelItemCount; i >= 0; i--) {
    this.extensionsList.takeTopLevelItem(i);
  }

  // populate the extension list
  for (var i in sellers) {
    var extensions = [];
    var sellerExtensions = sellers[i].extensions;

    // get extensions as a list to sort it alphabetically
    var extensionList = []
    for (var j in sellerExtensions){
      extensionList.push(sellerExtensions[j])
    }
    extensionList.sort(nameSort);

    for (var j in extensionList) {
      var extension = extensionList[j];
      if (this.storeFrame.showInstalledCheckbox.checked && !this.localList.isInstalled(extension)) continue;
      if (extension.matchesSearch(filter)) extensions.push(extension);
    }

    if (extensions.length == 0) continue;

    var sellerItem = new QTreeWidgetItem([sellers[i].name], 0);
    this.extensionsList.addTopLevelItem(sellerItem);
    sellerItem.setExpanded(true);

    for (var j in extensions) {
      var extensionItem = new ExtensionItem(extensions[j], this.localList);
      sellerItem.addChild(extensionItem);
      if (currentSelectionId && extensions[j].id == currentSelectionId) extensionItem.setSelected(true);
    }
  }
}


/**
 * Updates the info in the slideout description panel for the given extension
 * @param {storeLib.Extension} extension
 */
StoreUI.prototype.updateDescriptionPanel = function(extension) {
  this.storeDescriptionPanel.versionStoreLabel.text = extension.version;
  this.descriptionText.setHtml(extension.package.description);
  this.storeDescriptionPanel.storeKeywordsGroup.storeKeywordsLabel.text = extension.package.keywords.join(", ");
  this.storeDescriptionPanel.authorStoreLabel.text = extension.package.author;
  this.storeDescriptionPanel.sourceButton.toolTip = extension.package.repository;
  this.storeDescriptionPanel.websiteButton.toolTip = extension.package.website;

  // update install button to reflect whether or not the extension is already installed
  if (this.localList.isInstalled(extension)) {
    var localExtension = this.localList.extensions[extension.id];
    if (!localExtension.currentVersionIsOlder(extension.version) && this.localList.checkFiles(extension)) {
      this.storeDescriptionPanel.installButton.removeAction(this.installAction);
      this.storeDescriptionPanel.installButton.removeAction(this.updateAction);
      this.storeDescriptionPanel.installButton.setDefaultAction(this.uninstallAction);
    } else {
      //change to update
      this.storeDescriptionPanel.installButton.removeAction(this.installAction);
      this.storeDescriptionPanel.installButton.removeAction(this.uninstallAction);
      this.storeDescriptionPanel.installButton.setDefaultAction(this.updateAction);
    }
  } else {
    // installAction.setText("Install")
    this.storeDescriptionPanel.installButton.removeAction(this.uninstallAction);
    this.storeDescriptionPanel.installButton.removeAction(this.updateAction);
    this.storeDescriptionPanel.installButton.setDefaultAction(this.installAction);
  }
  this.storeDescriptionPanel.installButton.enabled = (extension.package.files.length > 0)

}


/**
 * Slide the extension description panel in and out
 */
StoreUI.prototype.toggleDescriptionPanel = function(){
  var selection = this.extensionsList.selectedItems();


  if (this.storeFrame.storeSplitter.sizes()[1] != 0) {
    this.storeFrameState = this.storeFrame.storeSplitter.saveState();
  }


  if (selection.length > 0 && selection[0].type() != 0) {
    this.storeFrame.storeSplitter.restoreState(this.storeFrameState);
    var id = selection[0].data(0, Qt.UserRole);
    var extension = this.store.extensions[id];

    // populate the description panel
    this.updateDescriptionPanel(extension);
  } else {
    // collapse description
    this.storeFrame.storeSplitter.setSizes([this.storeFrame.storeSplitter.width, 0]);
  }
}


/**
 * Installs the currently selected extension
 */
StoreUI.prototype.performInstall = function() {
  var selection = this.extensionsList.selectedItems();
  if (selection.length == 0) return
  var id = selection[0].data(0, Qt.UserRole);
  var extension = this.store.extensions[id];

  log.info("installing extension : " + extension.repository.name + extension.name);
  // log(JSON.stringify(extension.package, null, "  "))
  try {
    this.localList.install(extension);
    MessageBox.information("Extension " + extension.name + " v" + extension.version + "\nwas installed correctly.");
  } catch (err) {
    log.error(err);
    MessageBox.information("There was an error while installing extension\n" + extension.name + " v" + extension.version + ":\n\n" + err);
  }
  this.localList.refreshExtensions();
  this.updateExtensionsList();
}


/**
 * Uninstalls the currently selected extension
 */
StoreUI.prototype.performUninstall = function(){
  var selection = this.extensionsList.selectedItems();
  if (selection.length == 0) return;
  var id = selection[0].data(0, Qt.UserRole);
  var extension = this.store.extensions[id];

  log.info("uninstalling extension : " + extension.repository.name + extension.name);
  try {
    this.localList.uninstall(extension);
    MessageBox.information("Extension " + extension.name + " v" + extension.version + "\nwas uninstalled succesfully.");
  } catch (err) {
    log.error(err);
    MessageBox.information("There was an error while uninstalling extension\n" + extension.name + " v" + extension.version + ":\n\n" + err);
  }
  this.localList.refreshExtensions();
  this.updateExtensionsList();
}



/**
 * A QWebView to display the description
 * @param {QWidget} parent
 */
 function DescriptionView(parent){
  var webPreviewsFontFamily = "Arial";
  var webPreviewsFontSize = UiLoader.dpiScale(12);
  var webPreviewsStyleSheet = "QWebView { background-color: lightGrey; }";

  QWebView.call(this, parent)

  this.setStyleSheet(webPreviewsStyleSheet);
  this.setMinimumSize(0, 0);
  this.setSizePolicy(QSizePolicy.Maximum, QSizePolicy.Maximum);
  var settings = this.settings();
  settings.setFontFamily(QWebSettings.StandardFont, webPreviewsFontFamily);
  settings.setFontSize(QWebSettings.DefaultFontSize, webPreviewsFontSize);
}
DescriptionView.prototype = Object.create(QWebView.prototype)

/**
 * The QTreeWidgetTtem that represents a single extension in the store list.
 * @classdesc
 * @param {storeLib.Extension} extension           the extension which will be represented by this item
 * @param {storelib.LocalExtensionList} localList  the list of extensions installed on this machine
 * @param {QTreeWidget} parent                     the parent widget for this item
 */
 function ExtensionItem(extension, localList, parent) {
  this._parent = parent // this is the QTreeWidget
  var newExtensions = localList.getData("newExtensions", []);
  var extensionLabel = extension.name;

  if (newExtensions.indexOf(extension.id) != -1) extensionLabel += " ★new!"

  QTreeWidgetItem.call(this, [extensionLabel, icon], 1024);
  // add an icon in the middle column showing if installed and if update present
  if (localList.isInstalled(extension)) {
    var icon = "✓";
    this.setToolTip(1, "Extension is installed correctly.");
    var localExtension = localList.extensions[extension.id];
    log.debug(extension.id, localList.checkFiles(localExtension));
    if (localExtension.currentVersionIsOlder(extension.version)) {
      icon = "↺";
      this.setToolTip(1, "Update available:\ncurrently installed version : v" + extension.version);
    } else if (!localList.checkFiles(localExtension)) {
      icon = "!";
      this.setToolTip(1, "Some files from this extension are missing.");
    }
  } else {
    var icon = "✗";
  }
  this.setText(1, icon);

  // store the extension id in the item
  this.setData(0, Qt.UserRole, extension.id);
}
ExtensionItem.prototype = Object.create(QTreeWidgetItem.prototype);

exports.StoreUI = StoreUI;