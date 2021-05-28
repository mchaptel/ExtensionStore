var storelib = require("./lib/store.js");
var Logger = require("./lib/logger.js").Logger;
var log = new Logger("UI")
var WebIcon = require("./lib/network.js").WebIcon
var style = require("./lib/style.js");
var StyledImage = style.StyledImage

/**
 * The main extension store widget class
 */
function StoreUI(){
  this.store = new storelib.Store();
  log.debug("loading UI")

  // the list of installed extensions
  this.localList = new storelib.LocalExtensionList(this.store);

  // the extension representing the store on the remote repository
  this.storeExtension = this.store.storeExtension;

  // setting up UI ---------------------------------------------------
  var packageView = ScriptManager.getView("Extension Store");
  this.ui = ScriptManager.loadViewUI(packageView, "./resources/store.ui");
  this.ui.minimumWidth = UiLoader.dpiScale(350);
  this.ui.minimumHeight = UiLoader.dpiScale(200);

  // Set the global application stylesheet
  this.ui.setStyleSheet(style.getSyleSheet());

  // create shorthand references to some of the main widgets of the ui
  this.eulaFrame = this.ui.eulaFrame;
  this.storeFrame = this.ui.storeFrame;
  this.aboutFrame = this.ui.aboutFrame;
  this.storeListPanel = this.storeFrame.storeSplitter.extensionFrame;
  this.storeDescriptionPanel = this.storeFrame.storeSplitter.sidepanelFrame;
  this.extensionsList = this.storeListPanel.extensionsList;
  this.updateRibbon = this.aboutFrame.updateRibbon
  this.storeHeader = this.storeFrame.storeHeader;
  this.storeFooter = this.storeFrame.storeFooter;

  // Hide the store and the loading UI elements.
  this.storeFrame.hide();
  this.setUpdateProgressUIState(false);

  if (!this.localList.getData("HUES_EULA_ACCEPTED", false)) {
    this.aboutFrame.hide();

    // EULA logo
    var eulaLogo = new StyledImage(storelib.appFolder + "/resources/logo.png", 600, 150)
    this.eulaFrame.innerFrame.eulaLogo.setPixmap(eulaLogo.pixmap);

    this.eulaFrame.innerFrame.eulaCB.stateChanged.connect(this, function() {
      this.localList.saveData("HUES_EULA_ACCEPTED", true);
      this.eulaFrame.hide();
      this.aboutFrame.show();
    });
  }
  else {
    this.eulaFrame.hide();
  }

  // About logo
  var logo = new StyledImage(storelib.appFolder+"/resources/logo.png", 600, 150);
  this.aboutFrame.storeLabel.setPixmap(logo.pixmap);

  // Header logo
  var headerLogo = new StyledImage(storelib.appFolder+"/resources/icon.png", 24, 24);
  this.storeHeader.headerLogo.setPixmap(headerLogo.pixmap);

  this.checkForUpdates()

  // connect UI signals
  this.aboutFrame.loadStoreButton.clicked.connect(this, this.loadStore)

  // filter the store list --------------------------------------------
  this.storeHeader.searchStore.textChanged.connect(this, this.updateExtensionsList)

  // filter by installed only -----------------------------------------
  this.storeHeader.showInstalledCheckbox.toggled.connect(this, this.updateExtensionsList)

  // Clear search button ----------------------------------------------
  var clearSearchIcon = new StyledImage(storelib.appFolder+"/resources/cancel_icon.png");
  clearSearchIcon.setAsIcon(this.storeHeader.storeClearSearch)

  this.storeHeader.storeClearSearch.clicked.connect(this, function () {
    this.storeHeader.searchStore.text = "";
  })

  this.storeHeader.storeClearSearch.clicked.connect(this, function () {
    this.storeHeader.searchStore.text = "";
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

  this.storeFooter.registerButton.clicked.connect(this, this.registerExtension);

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
  var RegisterExtensionDialog = require("./lib/register.js").RegisterExtensionDialog;
  var registerDialog = new RegisterExtensionDialog(this.store, this.localList);
  registerDialog.show();
}


StoreUI.prototype.show = function(){
  this.ui.show()
}

/**
 * Show widgets responsible for showing progress to the user when loading the
 * store and retrieving extensions.
 * @param {boolean} visible - Determine whether the progress state should be enabled or disabled.
 */
StoreUI.prototype.setUpdateProgressUIState = function(visible){
  this.aboutFrame.updateButton.visible = !visible;
  this.aboutFrame.loadStoreButton.visible = !visible;
  this.aboutFrame.updateLabel.visible = visible;
  this.aboutFrame.updateProgress.visible = visible;
}


/**
 * Loads the store
 */
StoreUI.prototype.loadStore = function(){
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

  // Show progress dialog to give user indication that the list of extensions is being
  // updated.
  this.setUpdateProgressUIState(true);

  // Fetch the list of available extensions.
  try{
    this.storeExtensions = this.store.extensions;
  }catch(err){
    log.error(err)
    this.setUpdateProgressUIState(false);
    this.lockStore("Could not load Extensions list.")
    return
  }

  // saving the list of extensions so we can pinpoint the new ones at next startup and highlight them
  var oldExtensions = this.localList.getData("extensions", [])
  var newExtensions = this.localList.getData("newExtensions", [])
  oldExtensions = oldExtensions.concat(newExtensions); // saving the new extensions from last time as old
  newExtensions = [];

  var extensions = this.storeExtensions;
  for (var i in extensions) {
    if (oldExtensions.indexOf(extensions[i].id) == -1) newExtensions.push(extensions[i].id);
  }

  this.localList.saveData("extensions", oldExtensions);
  this.localList.saveData("newExtensions", newExtensions);

  this.updateExtensionsList();

  // Show the fully loaded store.
  this.storeFrame.show();
  this.aboutFrame.hide();
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
  var updateRibbon = this.updateRibbon

  var defaultRibbonStyleSheet = style.STYLESHEETS.defaultRibbonStyleSheet;
  var updateRibbonStyleSheet = style.STYLESHEETS.updateRibbonStyleSheet;
  var storeUi = this;

  try{
    var storeExtension = this.storeExtension;
    var storeVersion = storeExtension.version;
    var currentVersion = this.getInstalledVersion();
    this.storeFooter.storeVersionLabel.setText("v" + currentVersion );

    // if a more recent version of the store exists on the repo, activate the update ribbon
    if (!storeExtension.currentVersionIsOlder(currentVersion) && (currentVersion != storeVersion)) {
      updateRibbon.storeVersion.setText("v" + currentVersion + "  ⓘ New version available: v" + storeVersion);
      updateRibbon.setStyleSheet(updateRibbonStyleSheet);
      this.aboutFrame.updateButton.toolTip = storeExtension.package.description;
      this.aboutFrame.updateButton.clicked.connect(this, function(){storeUi.updateStore(currentVersion, storeVersion)});
    } else {
      this.aboutFrame.updateButton.hide();
      updateRibbon.storeVersion.setText("v" + currentVersion + " ✓ - Store is up to date.");
      updateRibbon.setStyleSheet(defaultRibbonStyleSheet);
    }
  }catch(err){
    // couldn't check updates, probably we don't have an internet access.
    // We set up an error message and disable load button.
    log.error(err)
    this.lockStore("Could not connect to GitHub. Store disabled, check internet access.");
  }
}


/**
 * Disable store load button and display an error message
 * @param {*} message
 */
StoreUI.prototype.lockStore = function(message){
  var noConnexionRibbonStyleSheet = style.STYLESHEETS.noConnexionRibbonStyleSheet;

  this.ui.aboutFrame.loadStoreButton.enabled = false;
  this.ui.aboutFrame.updateButton.hide();
  this.updateRibbon.setStyleSheet(noConnexionRibbonStyleSheet);
  this.updateRibbon.storeVersion.setText(message);
}


/**
 * installs the version of the store found on the repo.
 */
StoreUI.prototype.updateStore = function(currentVersion, storeVersion){
  var success = this.localList.install(this.storeExtension);
  if (success) {
    MessageBox.information("Store succesfully updated to version v" + storeVersion + ".\n\nPlease restart Harmony for changes to take effect.");
    this.updateRibbon.storeVersion.setText("v" + currentVersion);
    this.updateRibbon.setStyleSheet("");
    this.updateRibbon.updateButton.hide();
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

  var filter = this.storeHeader.searchStore.text;
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
      if (this.storeHeader.showInstalledCheckbox.checked && !this.localList.isInstalled(extension)) continue;
      if (extension.matchesSearch(filter)) extensions.push(extension);
    }

    if (extensions.length == 0) continue;

    var sellerItem = new QTreeWidgetItem([sellers[i].name], 0);
    this.extensionsList.addTopLevelItem(sellerItem);
    if (sellers[i].iconUrl){
      var sellerIcon = new WebIcon(sellers[i].iconUrl);
      sellerIcon.setToWidget(sellerItem);
    }
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

  var websiteIcon = new WebIcon(extension.package.website)
  websiteIcon.setToWidget(this.storeDescriptionPanel.websiteButton)

  // for some reason, this url is the only one that actually returns an icon
  var githubIcon = new StyledImage(style.ICONS.github)
  githubIcon.setAsIcon(this.storeDescriptionPanel.sourceButton)

  // update install button to reflect whether or not the extension is already installed
  if (this.localList.isInstalled(extension)) {
    var localExtension = this.localList.extensions[extension.id];
    if (!localExtension.currentVersionIsOlder(extension.version) && this.localList.checkFiles(extension)) {
      // Extension installed and up-to-date.
      this.storeDescriptionPanel.installButton.setStyleSheet(style.STYLESHEETS.uninstallButton);
      this.storeDescriptionPanel.installButton.removeAction(this.installAction);
      this.storeDescriptionPanel.installButton.removeAction(this.updateAction);
      this.storeDescriptionPanel.installButton.setDefaultAction(this.uninstallAction);
    } else {
      // Extension installed and update available.
      this.storeDescriptionPanel.installButton.setStyleSheet(style.STYLESHEETS.updateButton);
      this.storeDescriptionPanel.installButton.removeAction(this.installAction);
      this.storeDescriptionPanel.installButton.removeAction(this.uninstallAction);
      this.storeDescriptionPanel.installButton.setDefaultAction(this.updateAction);
    }
  } else {
    // Extension not installed.
    this.storeDescriptionPanel.installButton.setStyleSheet(style.STYLESHEETS.installButton);
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

  QWebView.call(this, parent)

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
    var iconPath = style.ICONS.installed;
    this.setToolTip(1, "Extension is installed correctly.");
    var localExtension = localList.extensions[extension.id];
    // log.debug("checking files from "+extension.id, localList.checkFiles(localExtension));
    if (localExtension.currentVersionIsOlder(extension.version)) {
      iconPath = style.ICONS.update;
      this.setToolTip(1, "Update available:\ncurrently installed version : v" + extension.version);
    } else if (!localList.checkFiles(localExtension)) {
      iconPath = style.ICONS.error;
      this.setToolTip(1, "Some files from this extension are missing.");
    }
  } else {
    iconPath = style.ICONS.notInstalled;
  }
  var icon = new StyledImage(iconPath);
  icon.setAsIcon(this, 1);

  if (extension.iconUrl){
    // set up an icon if one is available
    log.debug("adding icon to extension "+ extension.name + " from url : "+extension.iconUrl)
    this.extensionIcon = new WebIcon(extension.iconUrl);
    this.extensionIcon.setToWidget(this);

  }else{
    // fallback to local icon
    var extensionIcon = new StyledImage(storelib.appFolder + "/resources/default_extension_icon.png");
    extensionIcon.setAsIcon(this, 0);
  }

  // store the extension id in the item
  this.setData(0, Qt.UserRole, extension.id);
}
ExtensionItem.prototype = Object.create(QTreeWidgetItem.prototype);

exports.StoreUI = StoreUI;