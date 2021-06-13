var Logger = require("./logger.js").Logger;
var io = require("./io.js");
var log = new Logger("Style");
var appFolder = io.appFolder;

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
  "ACCENT_PRIMARY": "#5241B2", // Full intensity.
  "ACCENT_DARK": "#373061", // Subdued - 50% against 01DP.
  "ACCENT_BG": "#2B283B", // Very subdued - 20% against 01DP.
  "GREEN": "#30D158", // Valid.
  "RED": "#FF453A", // Error.
  "YELLOW": "#FFD60A", // New or updated.
  "ORANGE": "#FF9F0A", // Warning.
  "BLUE": "#A1CBEC",
}

// Enum to hold light style palette.
// TODO: Make dedicated light theme and associated palette.
const ColorsLight = ColorsDark;

// Use the appropriate colors const for further lookups.
const COLORS = isDarkStyle() ? ColorsDark : ColorsLight;

// Enum to hold light style palette.
const styleSheetsDark = {
  defaultRibbon : "QWidget { background-color: transparent; color: gray;}",
  updateRibbon : "QWidget { background-color: " + COLORS.YELLOW + "; color: black }",
  noConnexionRibbon : "QWidget { background-color: " + COLORS.RED + "; color: white; }",
  progressButton : "QToolButton { border-color: transparent transparent @ACCENT transparent; }",
  installButton : "QToolButton { border-color: transparent transparent " + COLORS.GREEN + " transparent; }",
  installFailedButton : "QToolButton { border-color: transparent transparent " + COLORS.RED + " transparent; }",
  uninstallButton : "QToolButton { border-color: transparent transparent " + COLORS.ORANGE + " transparent; }",
  updateButton : "QToolButton { border-color: transparent transparent " + COLORS.YELLOW + " transparent; }",
  loadButton : "QToolButton { border-color: transparent transparent " + COLORS.ACCENT_LIGHT + " transparent; }",
}

// Enum to hold light style stylesheets.
// TODO: Make dedicated light theme and associated stylesheets.
const styleSheetsLight = styleSheetsDark;

// Use the appropriate stylesheet const for further lookups.
const STYLESHEETS = isDarkStyle() ? styleSheetsDark : styleSheetsLight;

// Enum to hold application icons. Automatically return the appropriately themed
// image by calling getImage.
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
 * @returns {String} Resulting stylesheet based on the Application theme.
 */
function getStyleSheet() {
  var styleFile = appFolder + "/resources/stylesheet_dark.qss";
  var styleSheet = io.readFile(styleFile);

  // Get light-specific style overriddes
  if (!isDarkStyle()) {
      styleFileLight = appFolder + "/resources/stylesheet_light.qss";
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
 * @param {String} imagePath - Path to the image to be evaluated.
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


/**
 * Add a Dropshadow graphic effect to the provided widget.
 * @param {QWidget} widget - Widget to apply the dropshadow to.
 * @param {Int} radius - Radius of the blur applied to the dropshadow.
 * @param {Int} offsetX - How many pixels to offset the blur in the X coordinate.
 * @param {Int} offsetY - How many pixels to offset the blur in the Y coordinate.
 * @param {Int} opacity - Opacity from 0 => 255, where 0 is fully transparent.
 */
 function addDropShadow(widget, radius, offsetX, offsetY, opacity) {
  if (typeof radius === 'undefined') var radius = 10;
  if (typeof offsetX === 'undefined') var offsetX = 0;
  if (typeof offsetY === 'undefined') var offsetY = 3;
  if (typeof opacity === 'undefined') var opacity = 70;

  var dropShadow = new QGraphicsDropShadowEffect(widget);
  dropShadow.setBlurRadius(UiLoader.dpiScale(radius));
  dropShadow.setOffset(UiLoader.dpiScale(offsetX), UiLoader.dpiScale(offsetY));

  var shadowColor = new QColor(style.COLORS["00DP"]);
  shadowColor.setAlpha(opacity);
  dropShadow.setColor(shadowColor);

  // Apply the effect. Catch errors if a widget that doesn't support the setGraphicEffect call is provided.
  try {
    widget.setGraphicsEffect(dropShadow);
  }
  catch (err) {
    log.debug("Widget doesn't support setting a graphics effect.");
  }
}


/**
 * Class to handle the creation of Pixmaps, including suppoort for automatically
 * returning the correctly themed image, scaling Pixmaps if necessary, and applying onto
 * widgets as QIcons.\
 * @class
 * @param {String} imagePath - Path to the image.
 * @param {Int} width - Width in display pixels.
 * @param {Int} height  - Height in display pixels.
 * @param {Boolean} uniformScaling - Whether to maintain the original aspect ratio when scaling.
 */
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

/**
 * Filesystem path to the image - remapped to the appropriate theme.
 */
Object.defineProperty(StyledImage.prototype, "path", {
  get: function(){
    return this.getImage(this.basePath);
  }
})


/**
 * Create a new Pixmap for the image, scaling if necessary.
 */
Object.defineProperty(StyledImage.prototype, "pixmap", {
  get: function(){
    if (typeof this._pixmap === 'undefined') {
      log.debug("new pixmap for image : " + this.path);
      var pixmap = new QPixmap(this.path);

      // work out scaling based on params
      if (this.uniformScaling){
        if (this.width && this.height){
          // keep inside the given rectangle
          var aspectRatioFlag = Qt.KeepAspectRatio;
        }else{
          // if one of the width or height is missing, only the other value will be used
          var aspectRatioFlag = Qt.KeepAspectRatioByExpanding;
        }
      }else{
        // resize to match the box exactly
        var aspectRatioFlag = Qt.IgnoreAspectRatio;
      }

      var pixmap = pixmap.scaled(this.width, this.height, aspectRatioFlag, Qt.SmoothTransformation);

      this._pixmap = pixmap
    }
    return this._pixmap
  }
})


/**
 * Apply the image to a widget.
 * @param {QWidget} widget - The widget the image should be applied to as an icon.
 * @param {Int} itemColumn - Index of the column the icon should be applied to, if the widget is a QTreeWidgetItem.
 */
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


exports.addDropShadow = addDropShadow;
exports.getStyleSheet = getStyleSheet;
exports.StyledImage = StyledImage;
exports.STYLESHEETS = STYLESHEETS;
exports.ICONS = ICONS;
exports.COLORS = COLORS;