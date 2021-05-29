var Logger = require("./logger.js").Logger;
var io = require("./io.js");

var log = new Logger("Style");
var appFolder = require("./store.js").appFolder;

// Enum to hold dark style palette.
// 4% opacity over Material UI palette.
const ColorsDark = {
  "00DP": "#121115",
  "01DP": "#1E1D21",
  "02DP": "#232226",
  "03DP": "#252428",
  "04DP": "#29282C",
  "06DP": "#2C2B2F",
  "08DP": "#2E2D31",
  "12DP": "#333236",
  "16DP": "#363539",
  "24DP": "#38373B",
  "ACCENT_LIGHT": "#B6B1D8", // Lighter - 50% white screen overlaid.
  "ACCENT_PRIMARY": "#4B3C9E", // Full intensity
  "ACCENT_DARK": "#373061", // Subdued - 50% against D1
  "ACCENT_BG": "#2B283B", // Very subdued - 20% against D1
  "GREEN": "#30D158", // Valid.
  "RED": "#FF453A", // Error
  "YELLOW": "#FFD60A", // New or updated
  "ORANGE": "#FF9F0A", // Notice.
  "BLUE": "#A1CBEC", // Store update.
}

// Enum to hold light style palette.
// TODO: Make dedicated light theme and associated palette.
const ColorsLight = ColorsDark;

const COLORS = isDarkStyle() ? ColorsDark : ColorsLight;

const styleSheetsDark = {
  defaultRibbon : "QWidget { background-color: transparent; color: gray;}",
  updateRibbon : "QWidget { background-color: " + COLORS.YELLOW + "; color: black }",
  noConnexionRibbon : "QWidget { background-color: " + COLORS.RED + "; color: white; }",
  installButton : "QToolButton { border-color: transparent transparent " + COLORS.GREEN + " transparent; }",
  uninstallButton : "QToolButton { border-color: transparent transparent " + COLORS.ORANGE + " transparent; }",
  updateButton : "QToolButton { border-color: transparent transparent " + COLORS.YELLOW + " transparent; }"
}

const styleSheetsLight = styleSheetsDark;

const STYLESHEETS = isDarkStyle() ? styleSheetsDark : styleSheetsLight;


var iconFolder = appFolder + "/resources/icons";
const ICONS = {
  // Store
  "headerLogo": getImage(iconFolder + "/icon.png"),
  "cancelSearch": getImage(iconFolder + "/cancel_icon.png"),
  // Extension install states
  "installed": getImage(iconFolder + "/installed_icon.png"),
  "update": getImage(iconFolder + "/update_icon.png"),
  "error": getImage(iconFolder + "/error_icon.png"),
  "notInstalled": getImage(iconFolder + "/not_installed_icon.png"),
  // Store tree widget icons
  "defaultExtension": getImage(iconFolder + "/default_extension_icon.png"),
  "defaultGithubAvatar": getImage(iconFolder + "/default_github_avatar_icon.png"),
  // Social media
  "twitter": getImage(iconFolder + "/twitter_logo.png"),
  "github": getImage(iconFolder + "/github_logo.png"),
  "discord": getImage(iconFolder + "/discord_logo.png"),
}

/**
 * Detect the current Harmony application stylesheet.
 * @returns {Boolean} true if dark style active, false if light theme active.
 */
function isDarkStyle() {
  return preferences.getBool("DARK_STYLE_SHEET", "");
}


/**
 * Build and return a final qss string. Incorporate all necessary
 * style-specific overrides.
 */
function getSyleSheet() {
  var styleFile = storelib.appFolder + "/resources/stylesheet_dark.qss";
  var styleSheet = io.readFile(styleFile);

  // Get light-specific style overriddes
  if (!isDarkStyle()) {
      styleFileLight = storelib.appFolder + "/resources/stylesheet_light.qss";
      styleSheet += io.readFile(styleFileLight);
  }

  // Replace template colors with final palettes.
  for (color in COLORS) {
      var colorRe = new RegExp("@" + color, "g");
      styleSheet = styleSheet.replace(colorRe, COLORS[color]);
  }

  log.debug("Final qss stylesheet:\n" + styleSheet);
  return styleSheet;
}


/**
 * Return the appropriate image path based on Harmony style.
 * @param {String} imagePath
 * @returns {String} Path to the correct image for the Harmony style.
 */
function getImage(imagePath) {

  // Images are default themed dark - just return the original image if dark style is active.
  if (isDarkStyle()) {
      return imagePath;
  }

  // Harmony in light theme. Attempt to use @light variant.
  var image = new QFileInfo(imagePath);
  var imageRemapped = new QFileInfo(image.absolutePath() + "/" + image.baseName() + "@light." + image.suffix());
  if (imageRemapped.exists()) {
      log.debug("Using light themed variant of of " + imagePath);
      return imageRemapped.filePath();
  }

  // @light variant not found, fallback to using original image path.
  log.debug("No light styled variant of image, using default.");
  return imagePath;
}


function StyledImage(imagePath, width, height, uniformScaling) {
  if (typeof uniformScaling === 'undefined') var uniformScaling = true;
  if (typeof width === 'undefined') var width = 0;
  if (typeof height === 'undefined') var height = 0;

  this.width = UiLoader.dpiScale(width);
  this.height = UiLoader.dpiScale(height);

  this.uniformScaling = uniformScaling;
  this.basePath = imagePath;
  this.getImage = getImage;
}


Object.defineProperty(StyledImage.prototype, "path", {
  get: function(){
    return this.getImage(this.basePath);
  }
})


Object.defineProperty(StyledImage.prototype, "pixmap", {
  get: function(){
    if (typeof this._pixmap === 'undefined') {
      log.debug("new pixmap for image : " + this.path)
      var pixmap = new QPixmap(this.path);
      var aspectRatioFlag = this.uniformScaling?Qt.KeepAspectRatio:Qt.IgnoreAspectRatio;
      var pixmap = pixmap.scaled(this.width, this.height, aspectRatioFlag, Qt.SmoothTransformation);

      this._pixmap = pixmap
    }
    return this._pixmap
  }
})


StyledImage.prototype.setAsIcon = function(widget, itemColumn){
  if (widget instanceof QTreeWidgetItem){
    if (typeof itemColumn === 'undefined') var itemColumn = 0;
    var icon = new QIcon(this.path);
    widget.setIcon(itemColumn, icon);
  }else{
    log.debug("setting icon "+this.path)
    UiLoader.setSvgIcon(widget, this.path);
  }
}

exports.getSyleSheet = getSyleSheet;
exports.StyledImage = StyledImage;
exports.STYLESHEETS = STYLESHEETS;
exports.ICONS = ICONS;
exports.COLORS = COLORS;