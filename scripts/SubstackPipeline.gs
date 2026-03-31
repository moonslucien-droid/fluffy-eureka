// ============================================================
// LUCAS LUNES — Pipeline de publication automatique Substack
// Google Spreadsheet ID : 1zKtKH2eaaR3ZNQtVsS7ECffCrubmLIkQmC2BzNek2Qk
// ============================================================

var SPREADSHEET_ID     = "1zKtKH2eaaR3ZNQtVsS7ECffCrubmLIkQmC2BzNek2Qk";
var SHEET_NAME         = "Pipeline Articles";
var SUBSTACK_COOKIE    = ""; // À remplir : connect.sid=s%3A...
var SUBSTACK_URL       = "https://lucienmoons.substack.com/api/v1/drafts";
var UPLOAD_SECRET      = "lucas-lunes-drive-2026";
var IMAGES_FOLDER_NAME = "Images générées";

// ============================================================
// UTILITAIRE — Dossier "Images générées" dans Mon Drive
// ============================================================
function getImagesFolder() {
  var root    = DriveApp.getRootFolder();
  var folders = root.getFoldersByName(IMAGES_FOLDER_NAME);
  if (folders.hasNext()) {
    return folders.next();
  }
  return root.createFolder(IMAGES_FOLDER_NAME);
}

// ============================================================
// UPLOAD IMAGE — web app endpoint (appelé par Python)
// ============================================================
function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    if (data.secret !== UPLOAD_SECRET) {
      return ContentService
        .createTextOutput(JSON.stringify({"error": "Unauthorized"}))
        .setMimeType(ContentService.MimeType.JSON);
    }
    var decoded = Utilities.base64Decode(data.image_b64);
    var blob    = Utilities.newBlob(decoded, "image/png", data.filename);
    var folder  = getImagesFolder();
    var file    = folder.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    var link = "https://drive.google.com/file/d/" + file.getId() + "/view?usp=sharing";
    return ContentService
      .createTextOutput(JSON.stringify({"link": link, "fileId": file.getId()}))
      .setMimeType(ContentService.MimeType.JSON);
  } catch(err) {
    return ContentService
      .createTextOutput(JSON.stringify({"error": err.toString()}))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// ============================================================
// PUBLICATION AUTOMATIQUE — à 7h00 chaque matin
// ============================================================
function publierArticlesDuJour() {
  var ss      = SpreadsheetApp.openById(SPREADSHEET_ID);
  var ws      = ss.getSheetByName(SHEET_NAME);
  var data    = ws.getDataRange().getValues();
  var headers = data[0];

  var colId      = headers.indexOf("ID");
  var colStatut  = headers.indexOf("Statut");
  var colDatePub = headers.indexOf("Date à publier");
  var colTitre   = headers.indexOf("Titre");
  var colContenu = headers.indexOf("Contenu Substack");

  if (colId < 0 || colStatut < 0 || colDatePub < 0 || colTitre < 0 || colContenu < 0) {
    Logger.log("❌ Colonnes manquantes dans le sheet. Vérifier les en-têtes.");
    return;
  }

  var today = Utilities.formatDate(new Date(), "Europe/Paris", "dd/MM/yyyy");
  Logger.log("📅 Date du jour : " + today);

  for (var i = 1; i < data.length; i++) {
    var row     = data[i];
    var statut  = row[colStatut];
    var datePub = row[colDatePub];
    var titre   = row[colTitre];
    var contenu = row[colContenu];
    var id      = row[colId];

    if (!id || !titre) continue;

    var datePubStr = "";
    if (datePub instanceof Date) {
      datePubStr = Utilities.formatDate(datePub, "Europe/Paris", "dd/MM/yyyy");
    } else {
      datePubStr = String(datePub).trim();
    }

    Logger.log("📋 Article " + id + " | statut=" + statut + " | date=" + datePubStr);

    if (statut === "À publier" && datePubStr === today && contenu) {
      Logger.log("🚀 Publication de : " + titre);

      var contenuAvecPhotos = telechargerPhotosWikipedia(contenu, id);
      var result = posterSurSubstack(titre, contenuAvecPhotos);

      if (result.success) {
        ws.getRange(i + 1, colStatut + 1).setValue("Publié");
        Logger.log("✅ Publié : " + titre + " | draft_id=" + result.draft_id);
      } else {
        Logger.log("❌ Erreur publication : " + result.error);
      }
    }
  }
}

// ============================================================
// TÉLÉCHARGER PHOTOS WIKIPEDIA → Drive
// ============================================================
function telechargerPhotosWikipedia(contenu, articleId) {
  var regex    = /\[INSÉRER PHOTO \d+ — [^\]]*: (https:\/\/commons\.wikimedia\.org\/wiki\/File:[^\]]+)\]/g;
  var match;
  var resultat = contenu;

  while ((match = regex.exec(contenu)) !== null) {
    var fullTag  = match[0];
    var wikiUrl  = match[1];
    var filename = wikiUrl.split("File:")[1];

    try {
      var imageUrl = obtenirUrlDirecteWikimedia(filename);
      if (!imageUrl) { Logger.log("⚠️  URL introuvable pour : " + filename); continue; }

      var response = UrlFetchApp.fetch(imageUrl, {muteHttpExceptions: true});
      if (response.getResponseCode() !== 200) {
        Logger.log("⚠️  Téléchargement échoué (" + response.getResponseCode() + ") : " + filename);
        continue;
      }

      var blob   = response.getBlob().setName(articleId + "_" + filename);
      var folder = getImagesFolder();
      var file   = folder.createFile(blob);
      file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      var driveUrl = "https://drive.google.com/uc?id=" + file.getId();

      resultat = resultat.replace(fullTag, driveUrl);
      Logger.log("✅ Photo sauvée : " + filename + " → " + driveUrl);

    } catch(e) {
      Logger.log("❌ Erreur photo " + filename + " : " + e.toString());
    }
  }
  return resultat;
}

function obtenirUrlDirecteWikimedia(filename) {
  var apiUrl = "https://commons.wikimedia.org/w/api.php?action=query&titles=File:"
    + encodeURIComponent(filename) + "&prop=imageinfo&iiprop=url&format=json";
  var response = UrlFetchApp.fetch(apiUrl, {muteHttpExceptions: true});
  if (response.getResponseCode() !== 200) return null;
  var json  = JSON.parse(response.getContentText());
  var pages = json.query && json.query.pages;
  if (!pages) return null;
  for (var key in pages) {
    var info = pages[key].imageinfo;
    if (info && info[0] && info[0].url) return info[0].url;
  }
  return null;
}

// ============================================================
// POSTER SUR SUBSTACK
// ============================================================
function posterSurSubstack(titre, contenu) {
  if (!SUBSTACK_COOKIE) {
    return {success: false, error: "SUBSTACK_COOKIE non configuré"};
  }

  var html    = convertirMarkdownEnHtml(contenu);
  var payload = JSON.stringify({
    "draft_title": titre, "draft_body": html,
    "draft_subtitle": "", "section_chosen": false, "type": "newsletter"
  });
  var options = {
    method: "post", contentType: "application/json",
    headers: {"Cookie": SUBSTACK_COOKIE, "User-Agent": "Mozilla/5.0"},
    payload: payload, muteHttpExceptions: true
  };

  var response = UrlFetchApp.fetch(SUBSTACK_URL, options);
  var code = response.getResponseCode();
  var body = response.getContentText();

  if (code === 200 || code === 201) {
    try { return {success: true, draft_id: JSON.parse(body).id || "ok"}; }
    catch(e) { return {success: true, draft_id: "ok"}; }
  }
  return {success: false, error: "HTTP " + code + " — " + body.substring(0, 200)};
}

// ============================================================
// CONVERTIR MARKDOWN → HTML
// ============================================================
function convertirMarkdownEnHtml(texte) {
  if (!texte) return "";
  texte = texte.replace(/\[INSÉRER PHOTO \d+[^\]]*\]/g, "");
  texte = texte.replace(/\[PHOTO LUCAS LUNES[^\]]*: (https?:\/\/[^\]]+)\]/g,
    '<img src="$1" alt="Lucas Lunes" style="width:100%;max-width:600px;" />');
  texte = texte.replace(/\[PHOTO LUCAS LUNES[^\]]*PLACEHOLDER\]/g, "");
  texte = texte.replace(/\[([^\]]+)\]\((https?:\/\/[^\)]+)\)/g, '<a href="$2">$1</a>');
  texte = texte.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  texte = texte.replace(/\*([^*]+)\*/g, "<em>$1</em>");
  texte = texte.replace(/^---$/gm, "<hr/>");
  return texte.split(/\n\n+/).map(function(p) {
    p = p.trim();
    if (!p) return "";
    if (p.startsWith("<img") || p.startsWith("<hr")) return p;
    return "<p>" + p.replace(/\n/g, "<br/>") + "</p>";
  }).filter(function(p) { return p !== ""; }).join("\n");
}

// ============================================================
// CONFIGURER LE TRIGGER 7h00 (à lancer une seule fois)
// ============================================================
function configurerTrigger() {
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === "publierArticlesDuJour") {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }
  ScriptApp.newTrigger("publierArticlesDuJour")
    .timeBased().everyDays(1).atHour(7).create();
  Logger.log("✅ Trigger configuré : publierArticlesDuJour tous les jours à 7h00");
}
