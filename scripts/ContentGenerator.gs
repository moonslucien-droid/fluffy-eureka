// ============================================================
// LUCAS LUNES — Générateur de contenu éditorial
// Google Spreadsheet ID : 1zKtKH2eaaR3ZNQtVsS7ECffCrubmLIkQmC2BzNek2Qk
// ============================================================
// Ce script :
//   1. Lit les lignes avec Statut = "À rédiger"
//   2. Scrape le contenu brut depuis Arteviajero
//   3. Génère un dossier de recherche historique (Claude Opus 4.6)
//   4. Rédige l'article dans la voix Lucas Lunes (Claude Opus 4.6)
//   5. Remplit la colonne "Contenu Substack"
//   6. Passe le statut à "Brouillon"
// ============================================================

var SPREADSHEET_ID = "1zKtKH2eaaR3ZNQtVsS7ECffCrubmLIkQmC2BzNek2Qk";
var SHEET_NAME     = "Pipeline Articles";
var ANTHROPIC_API_KEY = ""; // À remplir : sk-ant-...
var CLAUDE_MODEL     = "claude-opus-4-6";

// ============================================================
// COLONNES (index 0-based, mappées sur les en-têtes)
// ============================================================
// ID | Date | Titre | Lieu | Lien Arteviajero | Mot-clé principal |
// Mots-clés secondaires | Potentiel SEO | Figure ♂ | Figure ♀ |
// Figure ✝ | Angle éditorial | Plan suggéré | Statut |
// Date rédaction | Date à publier | Notes | Contenu Substack

// ============================================================
// POINT D'ENTRÉE — Générer le contenu pour les articles "À rédiger"
// ============================================================
function genererContenuArticles() {
  var ss      = SpreadsheetApp.openById(SPREADSHEET_ID);
  var ws      = ss.getSheetByName(SHEET_NAME);
  var data    = ws.getDataRange().getValues();
  var headers = data[0];

  var col = {};
  for (var h = 0; h < headers.length; h++) {
    col[headers[h]] = h;
  }

  // Vérification des colonnes requises
  var required = ["ID", "Titre", "Lieu", "Lien Arteviajero", "Statut", "Contenu Substack",
                  "Figure ♂", "Figure ♀", "Figure ✝", "Angle éditorial", "Plan suggéré",
                  "Mot-clé principal", "Mots-clés secondaires"];
  for (var r = 0; r < required.length; r++) {
    if (col[required[r]] === undefined) {
      Logger.log("❌ Colonne manquante : " + required[r]);
      return;
    }
  }

  for (var i = 1; i < data.length; i++) {
    var row    = data[i];
    var statut = row[col["Statut"]];
    var id     = row[col["ID"]];

    if (!id) continue;
    if (statut !== "À rédiger") continue;

    Logger.log("🔄 Traitement de l'article : " + id + " — " + row[col["Titre"]]);

    try {
      // Mettre le statut en cours
      ws.getRange(i + 1, col["Statut"] + 1).setValue("Rédaction en cours");

      // 1. Scraper le contenu brut depuis Arteviajero
      var lienArteviajero = row[col["Lien Arteviajero"]];
      var contenuBrut = "";
      if (lienArteviajero) {
        contenuBrut = scraperArteviajero(lienArteviajero);
      }

      // 2. Préparer le contexte éditorial
      var contexte = {
        id:                id,
        titre:             row[col["Titre"]],
        lieu:              row[col["Lieu"]],
        lien:              lienArteviajero,
        motClePrincipal:   row[col["Mot-clé principal"]],
        motsClesSecondaires: row[col["Mots-clés secondaires"]],
        potentielSEO:      row[col["Potentiel SEO"]],
        figureHomme:       row[col["Figure ♂"]],
        figureFemme:       row[col["Figure ♀"]],
        figureReligieuse:  row[col["Figure ✝"]],
        angleEditorial:    row[col["Angle éditorial"]],
        planSuggere:       row[col["Plan suggéré"]],
        contenuBrut:       contenuBrut
      };

      // 3. Recherche historique
      Logger.log("📚 Recherche historique pour : " + contexte.lieu);
      var dossierRecherche = genererRechercheHistorique(contexte);

      // 4. Rédaction de l'article Lucas Lunes
      Logger.log("✍️ Rédaction Lucas Lunes pour : " + contexte.lieu);
      var article = redigerArticleLucasLunes(contexte, dossierRecherche);

      // 5. Remplir la colonne Contenu Substack
      ws.getRange(i + 1, col["Contenu Substack"] + 1).setValue(article);

      // 6. Passer le statut à Brouillon + date de rédaction
      ws.getRange(i + 1, col["Statut"] + 1).setValue("Brouillon");
      ws.getRange(i + 1, col["Date rédaction"] + 1).setValue(
        Utilities.formatDate(new Date(), "Europe/Paris", "dd/MM/yyyy")
      );

      Logger.log("✅ Article généré : " + id + " — " + contexte.titre);

    } catch(e) {
      Logger.log("❌ Erreur pour " + id + " : " + e.toString());
      ws.getRange(i + 1, col["Statut"] + 1).setValue("Erreur rédaction");
      ws.getRange(i + 1, col["Notes"] + 1).setValue("Erreur : " + e.toString());
    }
  }
}

// ============================================================
// SCRAPER ARTEVIAJERO — Extraction du contenu brut
// ============================================================
function scraperArteviajero(url) {
  if (!url || url.toString().trim() === "") return "";

  try {
    var response = UrlFetchApp.fetch(url, {
      muteHttpExceptions: true,
      headers: {
        "User-Agent": "LucasLunes-Editorial-Bot/1.0"
      }
    });

    if (response.getResponseCode() !== 200) {
      Logger.log("⚠️ Scraping échoué (" + response.getResponseCode() + ") : " + url);
      return "";
    }

    var html = response.getContentText();

    // Extraire le contenu principal (entre les balises article ou entry-content)
    var contenu = "";

    // Tentative 1 : entry-content
    var matchContent = html.match(/<div[^>]*class="[^"]*entry-content[^"]*"[^>]*>([\s\S]*?)<\/div>\s*<(?:footer|aside|nav|div[^>]*class="[^"]*(?:sidebar|comments|related))/i);
    if (matchContent) {
      contenu = matchContent[1];
    } else {
      // Tentative 2 : article tag
      var matchArticle = html.match(/<article[^>]*>([\s\S]*?)<\/article>/i);
      if (matchArticle) {
        contenu = matchArticle[1];
      } else {
        // Tentative 3 : body brut (dernier recours)
        var matchBody = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
        if (matchBody) contenu = matchBody[1];
      }
    }

    // Nettoyer le HTML → texte brut
    contenu = contenu.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "");
    contenu = contenu.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "");
    contenu = contenu.replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, "");
    contenu = contenu.replace(/<[^>]+>/g, " ");
    contenu = contenu.replace(/&nbsp;/g, " ");
    contenu = contenu.replace(/&amp;/g, "&");
    contenu = contenu.replace(/&lt;/g, "<");
    contenu = contenu.replace(/&gt;/g, ">");
    contenu = contenu.replace(/&#\d+;/g, "");
    contenu = contenu.replace(/\s+/g, " ").trim();

    // Limiter la taille pour l'API Claude
    if (contenu.length > 8000) {
      contenu = contenu.substring(0, 8000) + "…";
    }

    Logger.log("📄 Contenu scrapé (" + contenu.length + " chars) depuis : " + url);
    return contenu;

  } catch(e) {
    Logger.log("❌ Erreur scraping : " + e.toString());
    return "";
  }
}

// ============================================================
// RECHERCHE HISTORIQUE — Claude Opus 4.6
// ============================================================
function genererRechercheHistorique(contexte) {
  var systemPrompt = [
    "Tu es un chercheur historique rigoureux spécialisé dans le patrimoine ibérique.",
    "Tu produis des dossiers de recherche structurés, PAS des articles narratifs.",
    "",
    "RÈGLES :",
    "- Ne jamais inventer de faits historiques.",
    "- Citer les sources pour chaque affirmation majeure.",
    "- Distinguer clairement : fait documenté / tradition orale / interprétation.",
    "- Toujours inclure une section sur les femmes liées au lieu.",
    "- Toujours inclure une section sur les incertitudes à vérifier.",
    "",
    "FORMAT DE SORTIE (Markdown) :",
    "",
    "## Contexte historique",
    "[Origines, fondation, périodes majeures]",
    "",
    "## Personnages clés",
    "[Fondateurs, mécènes, figures notables avec dates et rôles]",
    "",
    "## Femmes liées à ce lieu",
    "[Section OBLIGATOIRE — reines, abbesses, bienfaitrices, artistes. Nommer les lacunes documentaires.]",
    "",
    "## Figures religieuses et ordres",
    "[Ordres religieux, saints, évêques, événements religieux]",
    "",
    "## Incertitudes et vérifications nécessaires",
    "[Liste des affirmations non vérifiées ou contradictoires]",
    "",
    "## Sources",
    "[URLs et références bibliographiques]"
  ].join("\n");

  var userPrompt = [
    "Lieu : " + contexte.lieu,
    "Titre : " + contexte.titre,
    "Mot-clé principal : " + contexte.motClePrincipal,
    "Figure masculine : " + (contexte.figureHomme || "Non spécifiée"),
    "Figure féminine : " + (contexte.figureFemme || "Non spécifiée"),
    "Figure religieuse : " + (contexte.figureReligieuse || "Non spécifiée"),
    "",
    "Contenu source brut (référence uniquement, NE PAS copier) :",
    contexte.contenuBrut || "(Aucun contenu source disponible)"
  ].join("\n");

  return appelClaude(systemPrompt, userPrompt, 0.3, 4000);
}

// ============================================================
// RÉDACTION ARTICLE LUCAS LUNES — Claude Opus 4.6
// ============================================================
function redigerArticleLucasLunes(contexte, dossierRecherche) {
  var systemPrompt = [
    "Tu es Lucas Lunes, un auteur-voyageur qui écrit sur les lieux de patrimoine de la péninsule ibérique.",
    "Tu n'es ni journaliste, ni guide touristique, ni historien. Tu es un écrivain qui écoute les lieux.",
    "",
    "TA VOIX :",
    "- Tu tutoies le lecteur, comme un compagnon.",
    "- Ton ton est intime, contemplatif, sans hâte.",
    "- Chaque lieu est une entité vivante — un témoin silencieux.",
    "- Tu remarques ce que les autres ignorent : la fissure, le silence, le nom effacé.",
    "- Tu es attiré par les seuils, les transitions, les traces d'absence.",
    "- Jamais de superlatifs : jamais 'magnifique', 'incontournable', 'pittoresque'.",
    "- Jamais de ton encyclopédique ou touristique.",
    "- L'histoire entre par les récits, pas par les dates sèches.",
    "",
    "STRUCTURE OBLIGATOIRE :",
    "",
    "1. OUVERTURE RITUELLE",
    "   Commence TOUJOURS par : \"Que s'est-il passé ce jour-là, en Espagne…\"",
    "   (ou \"Ce jour-là, au Portugal…\" si Portugal)",
    "",
    "2. APPROCHE",
    "   L'arrivée au lieu. Ce que le voyageur voit, entend, ressent en s'approchant.",
    "",
    "3. LE LIEU COMME PERSONNAGE",
    "   Le lieu n'est pas un décor. Décris-le comme une personne : sa posture, ses silences, ses cicatrices.",
    "",
    "4. TROIS VISITEURS",
    "   Introduis exactement TROIS visiteurs rencontrés au lieu :",
    "   - Fictifs mais plausibles",
    "   - Chacun perçoit le lieu différemment",
    "   - Brefs mais vivants : un geste, un mot, un silence",
    "",
    "5. COUCHES HISTORIQUES",
    "   Tisse le contenu historique du dossier de recherche dans la narration.",
    "   L'histoire émerge par un nom gravé, une anomalie architecturale, une réflexion.",
    "   Les femmes du dossier de recherche DOIVENT apparaître dans le récit.",
    "",
    "6. LÉGENDE LOCALE",
    "   Section obligatoire marquée '## Légende locale'",
    "   Une légende ou tradition locale liée au lieu.",
    "   Encadrée comme récit oral : 'On raconte que…' ou 'Les anciens disent…'",
    "",
    "7. DÉPART",
    "   Terminer par le départ. Pas de conclusion ni de résumé.",
    "   Le sentiment de s'éloigner d'un lieu qui continuera d'exister sans toi.",
    "",
    "RÈGLES STRICTES :",
    "- AUCUNE duplication du texte source ou du dossier de recherche.",
    "- AUCUNE liste encyclopédique de dates ou dimensions.",
    "- AUCUN marqueur IA : 'En conclusion', 'Il convient de noter', 'En effet'.",
    "- AUCUNE description générique — chaque phrase est spécifique à CE lieu.",
    "- Rigueur historique : tous les faits viennent du dossier de recherche.",
    "- Longueur : 1500–2500 mots.",
    "- Langue : français.",
    "- Format : Markdown propre.",
    "",
    "INCLURE EN FIN D'ARTICLE :",
    "- Les photos Wikimedia Commons pertinentes sous la forme :",
    "  [INSÉRER PHOTO N — description : https://commons.wikimedia.org/wiki/File:NomDuFichier.jpg]",
    "- Suggérer 2 à 4 photos en lien avec le lieu."
  ].join("\n");

  var userPrompt = [
    "LIEU : " + contexte.lieu,
    "TITRE : " + contexte.titre,
    "MOT-CLÉ PRINCIPAL : " + contexte.motClePrincipal,
    "MOTS-CLÉS SECONDAIRES : " + (contexte.motsClesSecondaires || ""),
    "ANGLE ÉDITORIAL : " + (contexte.angleEditorial || ""),
    "PLAN SUGGÉRÉ : " + (contexte.planSuggere || ""),
    "",
    "FIGURE MASCULINE : " + (contexte.figureHomme || "Non spécifiée"),
    "FIGURE FÉMININE : " + (contexte.figureFemme || "Non spécifiée"),
    "FIGURE RELIGIEUSE : " + (contexte.figureReligieuse || "Non spécifiée"),
    "",
    "DOSSIER DE RECHERCHE VALIDÉ :",
    dossierRecherche,
    "",
    "CONTENU SOURCE BRUT (référence uniquement, NE PAS copier) :",
    contexte.contenuBrut || "(Aucun contenu source disponible)",
    "",
    "Rédige l'article complet Lucas Lunes.",
    "Respecte la voix, la structure et les règles du system prompt.",
    "Inclus la section Légende locale.",
    "Inclus les trois visiteurs.",
    "Tisse les figures féminines du dossier de recherche."
  ].join("\n");

  return appelClaude(systemPrompt, userPrompt, 0.7, 6000);
}

// ============================================================
// APPEL CLAUDE OPUS 4.6 — API Anthropic
// ============================================================
function appelClaude(systemPrompt, userPrompt, temperature, maxTokens) {
  if (!ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY non configuré. Remplir la variable en haut du script.");
  }

  var payload = {
    "model": CLAUDE_MODEL,
    "max_tokens": maxTokens,
    "temperature": temperature,
    "system": systemPrompt,
    "messages": [
      {"role": "user", "content": userPrompt}
    ]
  };

  var options = {
    method: "post",
    contentType: "application/json",
    headers: {
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01"
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };

  var response = UrlFetchApp.fetch("https://api.anthropic.com/v1/messages", options);
  var code = response.getResponseCode();
  var body = response.getContentText();

  if (code !== 200) {
    throw new Error("Claude API erreur HTTP " + code + " : " + body.substring(0, 300));
  }

  var json = JSON.parse(body);
  if (!json.content || !json.content[0] || !json.content[0].text) {
    throw new Error("Réponse Claude inattendue : " + body.substring(0, 300));
  }

  return json.content[0].text;
}

// ============================================================
// GÉNÉRER UN SEUL ARTICLE PAR ID
// ============================================================
function genererArticleParId(articleId) {
  var ss      = SpreadsheetApp.openById(SPREADSHEET_ID);
  var ws      = ss.getSheetByName(SHEET_NAME);
  var data    = ws.getDataRange().getValues();
  var headers = data[0];

  var col = {};
  for (var h = 0; h < headers.length; h++) {
    col[headers[h]] = h;
  }

  for (var i = 1; i < data.length; i++) {
    if (data[i][col["ID"]] === articleId) {
      // Forcer le statut pour traitement
      ws.getRange(i + 1, col["Statut"] + 1).setValue("À rédiger");
      SpreadsheetApp.flush();
      genererContenuArticles();
      return;
    }
  }
  Logger.log("❌ Article non trouvé : " + articleId);
}

// ============================================================
// RACCOURCI — Générer l'article 2026-W13-02
// ============================================================
function generer_2026_W13_02() {
  genererArticleParId("2026-W13-02");
}

// ============================================================
// CONFIGURER LE TRIGGER — Menu personnalisé
// ============================================================
function onOpen() {
  var ui = SpreadsheetApp.getUi();
  ui.createMenu("🖊️ Lucas Lunes")
    .addItem("Générer les articles 'À rédiger'", "genererContenuArticles")
    .addItem("Générer article 2026-W13-02", "generer_2026_W13_02")
    .addToUi();
}
