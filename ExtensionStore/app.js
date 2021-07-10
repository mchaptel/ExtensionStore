var storelib = require("./lib/store.js");
var Logger = require("./lib/logger.js").Logger;
var WebIcon = require("./lib/network.js").WebIcon;
var style = require("./lib/style.js");
var widgets = require("./lib/widgets.js");
var appFolder = require("./lib/io.js").appFolder;
var DescriptionView = widgets.DescriptionView;
var ExtensionItem = widgets.ExtensionItem;
var LoadButton = widgets.LoadButton;
var InstallButton = widgets.InstallButton;
var ProgressBar = widgets.ProgressBar;
var SocialButton = widgets.SocialButton;
var StyledImage = style.StyledImage;

var log = new Logger("UI");

/**
 * The main extension store widget class
 */
function StoreUI() {
  this.store = new storelib.Store();
  log.debug("loading UI");

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
  this.ui.setStyleSheet(style.getStyleSheet());

  // Create Load Store Button
  this.loadStoreButton = new LoadButton();
  this.loadStoreButton.objectName = "loadStoreButton";
  style.addDropShadow(this.loadStoreButton, 10, 0, 8);

  // Create Store Update Button
  this.updateButton = new InstallButton();
  this.updateButton.mode = "Update";
  this.updateButton.objectName = "updateButton";
  this.updateButton.text = "Update Store";
  style.addDropShadow(this.updateButton, 10, 0, 8);

  // Create progressbar
  this.updateProgress = new ProgressBar();
  this.updateProgress.objectName = "updateProgress";

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

  // Add a dropshadow to the EULA inner frame.
  style.addDropShadow(this.eulaFrame.innerFrame, 10, 10, 10);
  style.addDropShadow(this.eulaFrame.innerFrame.textFrame, 5, 5, 5, 50);

  // Add a light dropshadow to the about screen text - to shadow the bottom border.
  style.addDropShadow(this.aboutFrame.label_3, 5, 5, 5, 25);

  // Insert the Loading button.
  this.aboutFrame.layout().insertWidget(6, this.loadStoreButton, 0, Qt.AlignCenter);

  // Insert the Store Update button.
  this.aboutFrame.layout().insertWidget(6, this.updateButton, 0, Qt.AlignCenter);

  // Insert the progress bar.
  this.aboutFrame.updateRibbon.layout().insertWidget(0, this.updateProgress, 0, Qt.AlignBottom);

  // Hide the store and the loading UI elements.
  this.storeFrame.hide();
  this.setStoreLoadUIState(false);

  if (!this.localList.getData("HUES_EULA_ACCEPTED", false)) {
    this.aboutFrame.hide();

    // EULA logo
    var eulaLogo = new StyledImage(appFolder + "/resources/logo.png", 380, 120);
    this.eulaFrame.innerFrame.eulaLogo.setPixmap(eulaLogo.pixmap);

    this.eulaFrame.innerFrame.eulaCB.stateChanged.connect(this, function () {
      this.localList.saveData("HUES_EULA_ACCEPTED", true);
      this.eulaFrame.hide();
      this.aboutFrame.show();
    });
  }
  else {
    this.eulaFrame.hide();
  }

  // About logo
  var logo = new StyledImage(appFolder + "/resources/logo.png", 380, 120);
  this.aboutFrame.storeLabel.setPixmap(logo.pixmap);

  // Social media buttons
  // Twitter
  var twitterIcon = new StyledImage(style.ICONS.twitter);
  twitterIcon.setAsIcon(this.aboutFrame.twitterButton);

  // Github
  var githubIcon = new StyledImage(style.ICONS.github);
  githubIcon.setAsIcon(this.aboutFrame.githubButton);

  // Discord
  var discordIcon = new StyledImage(style.ICONS.discord);
  discordIcon.setAsIcon(this.aboutFrame.discordButton);

  // Header logo
  var headerLogo = new StyledImage(style.ICONS.headerLogo, 22, 22);
  this.storeHeader.headerLogo.setPixmap(headerLogo.pixmap);

  this.checkForUpdates()

  // connect UI signals
  this.loadStoreButton.released.connect(this, this.loadStore);

  // Social media UI signals
  this.aboutFrame.twitterButton.clicked.connect(this, function () {
    QDesktopServices.openUrl(new QUrl(this.aboutFrame.twitterButton.toolTip));
  });
  this.aboutFrame.discordButton.clicked.connect(this, function () {
    QDesktopServices.openUrl(new QUrl(this.aboutFrame.discordButton.toolTip));
  });
  this.aboutFrame.githubButton.clicked.connect(this, function () {
    QDesktopServices.openUrl(new QUrl(this.aboutFrame.githubButton.toolTip));
  });

  this.store.onLoadProgressChanged.connect(this.updateProgress, this.updateProgress.setProgress);
  this.store.onLoadProgressChanged.connect(this.loadStoreButton, this.loadStoreButton.setProgress);
  this.localList.extensionsDetectionProgressChanged.connect(this.loadStoreButton, this.loadStoreButton.setProgress);

  // filter the store list --------------------------------------------
  this.storeHeader.searchStore.textChanged.connect(this, this.updateExtensionsList)

  // filter by installed only -----------------------------------------
  this.storeHeader.showInstalledCheckbox.toggled.connect(this, this.updateExtensionsList)

  // Clear search button ----------------------------------------------
  var clearSearchIcon = new StyledImage(style.ICONS.cancelSearch);
  clearSearchIcon.setAsIcon(this.storeHeader.storeClearSearch)

  var searchField = this.storeHeader.searchStore
  var searchClear = this.storeHeader.storeClearSearch
  var searchFieldSize = searchField.maximumWidth

  searchField.textChanged.connect(this, function () {
    var visible = !!searchField.text;
    searchClear.visible = visible;
    searchField.maximumWidth = searchFieldSize - searchClear.width * visible;
  })
  searchClear.hide()

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

  this.storeFrame.storeSplitter.splitterMoved.connect(this, this.resizeColumns);

  // Install Button Actions -------------------------------------------
  this.installButton = new InstallButton();
  this.installButton.objectName = "installButton";
  this.storeDescriptionPanel.installButtonPlaceHolder.layout().addWidget(this.installButton, 1, Qt.AlignCenter);

  this.installButton.modes.INSTALL.action.triggered.connect(this, this.performInstall);
  this.installButton.modes.UPDATE.action.triggered.connect(this, this.performInstall);
  this.installButton.modes.UNINSTALL.action.triggered.connect(this, this.performUninstall);

  // Add Dropshadow to buttons.
  style.addDropShadow(this.installButton, 10, 0, 8);
  style.addDropShadow(this.storeDescriptionPanel.websiteButton);
  style.addDropShadow(this.storeDescriptionPanel.sourceButton);
}


/**
 * The currently selected Extension in the list.
 */
 Object.defineProperty(StoreUI.prototype, "selectedExtension", {
  get: function(){
    var selection = this.extensionsList.selectedItems();
    if (selection.length > 0 && selection[0].type() != 0){
      var id = selection[0].data(0, Qt.UserRole);
      var extension = this.store.extensions[id];

      return extension;
    }
    return null;
  }
})


/**
 * Brings up the register extension dialog for script makers
 */
StoreUI.prototype.registerExtension = function () {
  var RegisterExtensionDialog = require("./lib/register.js").RegisterExtensionDialog;
  var registerDialog = new RegisterExtensionDialog(this.store, this.localList);
  registerDialog.show();
}


StoreUI.prototype.show = function () {
  this.ui.show()
}

/**
 * Show widgets responsible for showing progress to the user when loading the
 * store and retrieving extensions.
 * @param {boolean} enabled - Determine whether the progress state should be enabled or disabled.
 */
StoreUI.prototype.setStoreLoadUIState = function (enabled) {
  if (enabled) {
    // Hide elements during store load without removing them from the UI to avoid elements shifting.
    this.updateButton.setStyleSheet(style.STYLESHEETS.InstallButtonInvisible);
    this.updateButton.setGraphicsEffect(null);
    this.aboutFrame.updateRibbon.setStyleSheet(style.STYLESHEETS.defaultRibbon);
    this.aboutFrame.updateRibbon.storeVersion.toolTip = this.aboutFrame.updateRibbon.storeVersion.text;
    this.aboutFrame.updateRibbon.storeVersion.text = "";
  }
  else {
    // Restore store text.
    this.aboutFrame.updateRibbon.storeVersion.text = this.aboutFrame.updateRibbon.storeVersion.toolTip;
    this.aboutFrame.updateRibbon.storeVersion.toolTip = "";
  }

  this.updateProgress.visible = enabled;
}


/**
 * Loads the store
 */
StoreUI.prototype.loadStore = function () {
  // setup the scrollArea containing the webview
  this.descriptionText = new DescriptionView()
  var webWidget = this.storeDescriptionPanel.webContent;
  webWidget.setLayout(new QVBoxLayout());
  webWidget.layout().setContentsMargins(0, 0, 0, 0);
  webWidget.layout().addWidget(this.descriptionText, 0, Qt.AlignTop);

  // Show progress dialog to give user indication that the list of extensions is being
  // updated.
  this.setStoreLoadUIState(true);

  // Fetch the list of available extensions.
  try {
    this.storeExtensions = this.store.extensions;
  } catch (err) {
    log.error(err)
    this.setStoreLoadUIState(false);
    this.lockStore("Could not load Extensions list.")
    return
  }

  // Update UI as updating the extension list on first load can be time intensive.
  this.loadStoreButton.maximumWidth = 500;
  this.loadStoreButton.text = "Detecting installed extensions...";
  this.loadStoreButton.toolTip = "";
  this.loadStoreButton.enabled = false;

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

  // set default expanded size to half the splitter size
  var storeFrame = this.storeFrame;
  storeFrame.storeSplitter.setSizes([storeFrame.width / 2, storeFrame.width / 2]);
  this.storeFrameState = storeFrame.storeSplitter.saveState();

  // setup the store widget sizes
  this.resizeColumns()

  storeFrame.storeSplitter.setSizes([storeFrame.storeSplitter.width, 0]);
}



/**
 * Looks for the version in the local list, first by id, then by name in case ID changed.
 * @returns {string}  the current version of the installed store
 */
StoreUI.prototype.getInstalledVersion = function () {
  if (this.localList.list.length > 0) {
    if (this.localList.hasOwnProperty(this.storeExtension.id)) {
      var installedStore = this.localList.extensions[this.storeExtension.id];
    } else {
      // in case id changed (repo changed), we search by name
      for (var i in this.localList.extensions) {
        if (this.localList.extensions[i].name == this.storeExtension.name) {
          var installedStore = this.localList.extensions[i];
          break;
        }
      }
    }

    var currentVersion = installedStore.version;
  } else {
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
StoreUI.prototype.checkForUpdates = function () {
  var updateRibbon = this.updateRibbon
  var storeUi = this;

  try {
    var storeExtension = this.storeExtension;
    var storeVersion = storeExtension.version;
    var currentVersion = this.getInstalledVersion();
    this.storeFooter.storeVersionLabel.setText("v" + currentVersion);

    // if a more recent version of the store exists on the repo, activate the update ribbon
    if (!storeExtension.currentVersionIsOlder(currentVersion) && (currentVersion != storeVersion)) {
      updateRibbon.storeVersion.setText("v" + currentVersion + "  ⓘ New version available: v" + storeVersion);
      updateRibbon.setStyleSheet(style.STYLESHEETS.updateRibbon);
      this.updateButton.toolTip = storeExtension.package.description;
      this.updateButton.clicked.connect(this, function () { storeUi.updateStore(currentVersion, storeVersion) });
    } else {
      this.updateButton.hide();
      updateRibbon.storeVersion.setText("v" + currentVersion + " ✓ - Store is up to date.");
      updateRibbon.setStyleSheet(style.STYLESHEETS.defaultRibbon);
    }
  } catch (err) {
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
StoreUI.prototype.lockStore = function (message) {
  var noConnexionRibbonStyleSheet = style.STYLESHEETS.failureRibbon;

  this.ui.aboutFrame.loadStoreButton.enabled = false;
  this.updateButton.hide();
  this.updateRibbon.setStyleSheet(noConnexionRibbonStyleSheet);
  this.updateRibbon.storeVersion.setText(message);
}


/**
 * installs the version of the store found on the repo.
 */
StoreUI.prototype.updateStore = function (currentVersion, storeVersion) {
  // Store shouldn't load after update until it's been reloaded.
  this.loadStoreButton.setStyleSheet(style.STYLESHEETS.InstallButtonInvisible);
  this.loadStoreButton.setGraphicsEffect(null);
  this.loadStoreButton.enabled = false;
  this.loadStoreButton.toolTip = "";

  // set progress directly once to make the button feel more reponsive while thhe store fetches info
  this.updateButton.setProgress(0.001);

  log.info("installing extension : " + this.storeExtension.repository.name + this.storeExtension.name);
  var installer = this.storeExtension.installer;

  // Log store update error.
  this.failure = function (err){
    log.error(err);
  }

  // Connect the installer signals to the update button.
  installer.onInstallProgressChanged.connect(this.updateButton, this.updateButton.setProgress);
  installer.onInstallFailed.connect(this, this.failure);
  installer.onInstallFailed.connect(this.updateButton, this.updateButton.setFailState);

  // Remove existing files before updating the store.
  try {
    this.localList.update(this.storeExtension);

    // Updated successfully - Adjust UI to indicate update success without shifting the UI.
    this.updateRibbon.storeVersion.setText("v" + currentVersion);
    this.updateRibbon.setStyleSheet(style.STYLESHEETS.defaultRibbon);
    this.updateButton.setStyleSheet(style.STYLESHEETS.updateButtonSuccess);
    this.updateButton.maximumWidth = 500;
    this.updateButton.text = "Please reload HUES to apply the update.";
    this.updateButton.setGraphicsEffect(null);
    this.updateButton.toolTip = "";
    this.updateButton.enabled = false;

    MessageBox.information("Store succesfully updated to version v" + storeVersion + ".\n\nPlease close and reopen HUES for changes to take effect.");
  }
  catch (err) {
    // Only log errors as it's not a crucial step in updating the extension.
    log.debug("Unable to remove local files before updating store. " + err);
    // Update failed - set to the RED failure style.
    this.updateRibbon.setStyleSheet(style.STYLESHEETS.failureRibbon);
    this.updateButton.setFailState();
    this.updateButton.enabled = false;
    MessageBox.information("There was a problem updating to v" + storeVersion + ".\n\n The update was not successful.");
  }
}


/**
 * Updates the list widget displaying the extensions
 */
StoreUI.prototype.updateExtensionsList = function () {
  if (this.localList.list.length == 0){
    try{
      this.localList.createListFile(this.store);
    }catch(err){
      MessageBox.trace("Error during detection of existing extensions : "+err.message)
    }
  }
  log.debug("updating extensions list")

  function nameSort(a, b) {
    return a.name.toLowerCase() < b.name.toLowerCase() ? -1 : 1
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
    for (var j in sellerExtensions) {
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
    if (sellers[i].iconUrl) {
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
 * Updates the info in the slideout description panel for the currently selected extension
 */
StoreUI.prototype.updateDescriptionPanel = function () {
  var extension = this.selectedExtension;
  if (!extension) return
  if (this.installing) return

  var website = extension.package.website;
  var author = extension.package.author;
  var socials = extension.repository.seller.socials;

  this.storeDescriptionPanel.versionStoreLabel.text = extension.version;
  this.descriptionText.setHtml(extension.package.description);
  this.storeDescriptionPanel.storeKeywordsGroup.storeKeywordsLabel.text = extension.package.keywords.join(", ");
  this.storeDescriptionPanel.authorStoreLabel.text = author?author:extension.repository.seller.name;
  this.storeDescriptionPanel.sourceButton.toolTip = extension.package.repository;
  this.storeDescriptionPanel.websiteButton.toolTip = website?website:extension.repository.seller.website;

  var websiteIcon = new WebIcon(extension.package.website);
  websiteIcon.setToWidget(this.storeDescriptionPanel.websiteButton);

  var githubIcon = new StyledImage(style.ICONS.github);
  githubIcon.setAsIcon(this.storeDescriptionPanel.sourceButton);

  // create buttons next to the name for social links
  var socialsLayout = this.storeDescriptionPanel.authorSocialFrame.layout()
  // clear existing social buttons
  while(socialsLayout.count()){
    var button = socialsLayout.takeAt(0).widget();
    button.deleteLater();
  }

  socials = socials.slice(0,4) // limit the display at 4 links
  for (var i in socials){
    var socialButton = new SocialButton(socials[i]);
    socialsLayout.addWidget(socialButton, 0, Qt.AlignCenter);
  }

  // update install button to reflect whether or not the extension is already installed
  if (this.localList.isInstalled(extension)) {
    var localExtension = this.localList.extensions[extension.id];
    if (!localExtension.currentVersionIsOlder(extension.version) && this.localList.checkFiles(extension)) {
      // Extension installed and up-to-date.
      log.debug("set button to uninstall");
      this.installButton.mode = "Uninstall";
    } else {
      log.debug("set button to update")
      // Extension installed and update available.
      this.installButton.mode = "Update";
    }
  } else {
    // Extension not installed.
    log.debug("set button to install")
    this.installButton.mode = "Install";
  }
  this.installButton.enabled = (extension.package.files.length > 0)
}


/**
 * Slide the extension description panel in and out
 */
StoreUI.prototype.toggleDescriptionPanel = function () {
  // only save the splitter size if it's not collapsed
  if (this.storeFrame.storeSplitter.sizes()[1] != 0) {
    this.storeFrameState = this.storeFrame.storeSplitter.saveState();
  }
  var extension = this.selectedExtension;

  if (extension) {
    this.storeFrame.storeSplitter.restoreState(this.storeFrameState);
    // populate the description panel
    this.updateDescriptionPanel();
  } else {
    // collapse description
    this.storeFrame.storeSplitter.setSizes([this.storeFrame.storeSplitter.width, 0]);
  }
}


StoreUI.prototype.resizeColumns = function(){
  var list = this.extensionsList;
  var scroll = list.verticalScrollBar();
  list.setColumnWidth(1, UiLoader.dpiScale(35));
  list.setColumnWidth(0, list.width - scroll.visible*scroll.width - list.columnWidth(1));
}

/**
 * Installs the currently selected extension
 */
StoreUI.prototype.performInstall = function () {
  this.installing = true;
  var extension = this.selectedExtension;
  if (!extension) return;

  // set progress directly once to make the button feel more reponsive while thhe store fetches info
  this.installButton.setProgress(0.001);

  log.info("installing extension : " + extension.repository.name + extension.name);
  var installer = extension.installer;

  // Log extension installation error.
  this.failure = function (err){
    log.error(err);
    this.installButton.setFailState()
    this.installing = false;
  }

  installer.onInstallProgressChanged.connect(this.installButton, this.installButton.setProgress);
  installer.onInstallFailed.connect(this, this.failure);

  // Attempt to install the extension.
  try{
    this.localList.install(extension);

    // delay refresh after install completes
    var timer = new QTimer();
    timer.singleShot = true;
    timer["timeout"].connect(this, function() {
      this.installing = false;
      this.localList.refreshExtensions();
      this.updateExtensionsList();
      this.updateDescriptionPanel();
    });
    timer.start(1000);
  }catch(error) {
    // If extension install failed - alert user.
    // Not in failure function to avoid being called for each failed proc, and to only appear after InstallButton has changed to a failed state.
    MessageBox.information("There was an error while installing extension\n" + extension.name + " v" + extension.version + ":\n\n" + error);
  }
}


/**
 * Uninstalls the currently selected extension
 */
StoreUI.prototype.performUninstall = function () {
  this.installing = true;

  var extension = this.selectedExtension
  if (!extension) return

  log.info("uninstalling extension : " + extension.repository.name + extension.name);
  try {
    this.localList.uninstall(extension);
    MessageBox.information("Extension " + extension.name + " v" + extension.version + "\nwas uninstalled succesfully.");
  } catch (err) {
    log.error(err);
    MessageBox.information("There was an error while uninstalling extension\n" + extension.name + " v" + extension.version + ":\n\n" + err);
  }

  this.installing = false;

  this.localList.refreshExtensions();
  this.updateExtensionsList();
}


exports.StoreUI = StoreUI;