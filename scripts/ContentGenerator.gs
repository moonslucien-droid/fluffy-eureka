// ============================================================
// LUCAS LUNES — Pipeline éditorial complet
// Google Spreadsheet ID : 1zKtKH2eaaR3ZNQtVsS7ECffCrubmLIkQmC2BzNek2Qk
// ============================================================
// FLUX :
//   À vérifier → (humain approuve titre) → Brouillon
//   Brouillon (sans contenu) → script écrit 1er jet → Brouillon (avec contenu)
//   Brouillon → (humain corrige dans Contenu Substack) → Texte final
//   Texte final → script réécrit version finale → Notes = "Réécriture finale OK"
//   (humain peut re-corriger : effacer Notes → script réécrit à nouveau)
//   Texte final → (humain valide) → À publier
//   À publier → script génère photo Nanabana + sauvegarde Drive + publie Substack → Publié
// ============================================================

var SPREADSHEET_ID     = "1zKtKH2eaaR3ZNQtVsS7ECffCrubmLIkQmC2BzNek2Qk";
var SHEET_NAME         = "Pipeline Articles";
var ANTHROPIC_API_KEY  = ""; // À remplir dans Apps Script : sk-ant-...
var CLAUDE_MODEL       = "claude-opus-4-6";
var GOOGLE_API_KEY     = ""; // À remplir dans Apps Script : AIza...
var LUCAS_LUNES_PHOTO_ID = "1ZFz-GMbrF96vF59fYL8iym9yPfuYpmqJ";
var SUBSTACK_COOKIE    = ""; // À remplir : connect.sid=s%3A...
var SUBSTACK_URL       = "https://lucienmoons.substack.com/api/v1/drafts";
var DRIVE_FOLDER_NAME  = "Lucas Lunes — Production Hub";
var MAC_BASE_PATH      = "/Users/lucienmoons/Desktop/2026 digital business AI ideas  2026 article patrimoine weekly";

// ============================================================
// PROMPT NANABANA — Génération photo Lucas Lunes sur le lieu
// ============================================================
var NANABANA_BASE_PROMPT = [
  "[SÉQUENCE DE CONSIGNES STRICTES : AUCUNE DÉVIATION DU SUJET AUTORISÉE. NE PAS CHANGER L'IDENTITÉ OU LES ACCESSOIRES.]",
  "[SÉQUENCE DE CONSIGNES PRIORITAIRES : AUCUNE DÉVIATION DE L'IDENTITÉ FACIALE N'EST AUTORISÉE. UTILISER EXCLUSIVEMENT LA PHOTO DE RÉFÉRENCE COMME RÉFÉRENCE ABSOLUE POUR LE VISAGE.]",
  "Une photographie de portrait ultra-réaliste, en très haute résolution, centrée et nette du personnage masculin âgé vu dans la photo de référence. L'objectif principal est de reproduire l'identité faciale exacte, sans aucune hallucination ou changement de personne.",
  "",
  "Description Physique et Identité Faciale (Respect strict requis) :",
  "• Visage : Reproduire la structure faciale unique, les traits précis et l'expression du personnage de la photo de référence. Cela inclut le pli nasolabial marqué, la forme du nez, la structure de la mâchoire et, crucialement, les rides d'expression profondes et bien définies autour de la bouche et des yeux.",
  "• Expression : Reproduire le sourire authentique, chaleureux et légèrement asymétrique, plissant les yeux.",
  "• Détails de peau : La texture de la peau âgée doit être extrêmement détaillée : pores visibles, pigmentation naturelle, et surtout, les rides et plis spécifiques, notamment le pli sous l'œil gauche et les rides autour de la bouche, exactement comme dans la photo de référence.",
  "",
  "Description des Accessoires et Vêtements (Identiques à la photo de référence) :",
  "• Couvre-chef : Un véritable chapeau Fedora de couleur kaki (vert olive), avec une bande d'imprimé léopard distincte et texturée autour de la couronne.",
  "• Lunettes : Les lunettes de soleil spécifiques de style Wayfarer, avec la monture en écaille de tortue (brun moucheté) et des verres teintés en marron.",
  "• Vêtements : La veste de style saharienne/militaire en coton de couleur kaki, avec quatre poches boutonnées à rabat et des pattes d'épaule, portée ouverte sur un t-shirt noir uni.",
  "",
  "Composition et Éclairage :",
  "• Un plan moyen (mid-shot), cadré du buste à la tête, centré, avec le personnage regardant directement vers le lieu, ou la caméra.",
  "• Éclairage : Un éclairage naturel diffus pour mettre en valeur les textures et les détails du visage sans créer d'ombres dures qui pourraient déformer les traits.",
  "",
  "Arrière-plan :",
  "• IMPORTANT : Le personnage se trouve DEVANT {{LIEU}}. L'arrière-plan montre ce lieu historique de manière reconnaissable mais légèrement floutée (profondeur de champ), tout en maintenant le personnage comme point focal absolu."
].join("\n");

// ============================================================
// POINT D'ENTRÉE PRINCIPAL
// ============================================================
function traiterPipeline() {
  var ss      = SpreadsheetApp.openById(SPREADSHEET_ID);
  var ws      = ss.getSheetByName(SHEET_NAME);
  var data    = ws.getDataRange().getValues();
  var headers = data[0];

  var col = {};
  for (var h = 0; h < headers.length; h++) {
    col[headers[h]] = h;
  }

  var required = ["ID", "Titre", "Lieu", "Lien Arteviajero", "Statut", "Contenu Substack",
                  "Figure ♂", "Figure ♀", "Figure ✝", "Angle éditorial", "Plan suggéré",
                  "Mot-clé principal", "Mots-clés secondaires", "Notes"];
  for (var r = 0; r < required.length; r++) {
    if (col[required[r]] === undefined) {
      Logger.log("❌ Colonne manquante : " + required[r]);
      return;
    }
  }

  var traite = false; // UN SEUL article par exécution (limite 6 min Apps Script)

  for (var i = 1; i < data.length; i++) {
    if (traite) break; // Déjà traité un article, on arrête

    var row    = data[i];
    var statut = String(row[col["Statut"]]).trim();
    var id     = String(row[col["ID"]]).trim();
    var contenuExistant = String(row[col["Contenu Substack"]] || "").trim();
    var notes  = String(row[col["Notes"]] || "").trim();

    if (!id) continue;

    // ── BROUILLON sans contenu : générer le premier jet ──
    if (statut === "Brouillon" && contenuExistant === "") {
      Logger.log("🔄 Premier jet pour : " + id);
      try {
        ws.getRange(i + 1, col["Statut"] + 1).setValue("Rédaction en cours");
        SpreadsheetApp.flush();

        var contexte = extraireContexte(row, col);

        Logger.log("📚 Recherche historique pour : " + contexte.lieu);
        var dossierRecherche = genererRechercheHistorique(contexte);

        Logger.log("✍️ Rédaction premier jet pour : " + contexte.lieu);
        var article = redigerArticleLucasLunes(contexte, dossierRecherche);

        // Ajouter le compteur de mots et temps de lecture sous le titre
        article = ajouterMetadonnees(article);

        // Sauvegarder dans Google Drive dès le premier jet
        var articleFolder = creerDossierArticle(id);
        var titre = row[col["Titre"]];
        sauvegarderArticleMarkdown(articleFolder, id, titre, article);
        Logger.log("💾 Premier jet sauvegardé dans Drive : " + DRIVE_FOLDER_NAME + "/" + id);

        ws.getRange(i + 1, col["Contenu Substack"] + 1).setValue(article);
        ws.getRange(i + 1, col["Statut"] + 1).setValue("Brouillon");
        ws.getRange(i + 1, col["Date rédaction"] + 1).setValue(
          Utilities.formatDate(new Date(), "Europe/Paris", "dd/MM/yyyy")
        );
        ws.getRange(i + 1, col["Notes"] + 1).setValue("Premier jet généré le " +
          Utilities.formatDate(new Date(), "Europe/Paris", "dd/MM/yyyy HH:mm"));

        Logger.log("✅ Premier jet généré : " + id);
        traite = true;
      } catch(e) {
        Logger.log("❌ Erreur premier jet " + id + " : " + e.toString());
        ws.getRange(i + 1, col["Statut"] + 1).setValue("Erreur rédaction");
        ws.getRange(i + 1, col["Notes"] + 1).setValue("Erreur : " + e.toString());
        traite = true;
      }
    }

    // ── TEXTE FINAL : réécrire si pas encore fait ──
    if (statut === "Texte final" && contenuExistant !== "" && notes.indexOf("Réécriture finale OK") === -1) {
      Logger.log("🔄 Réécriture finale pour : " + id);
      try {
        ws.getRange(i + 1, col["Notes"] + 1).setValue("Réécriture en cours…");
        SpreadsheetApp.flush();

        var contexte2 = extraireContexte(row, col);

        Logger.log("✍️ Réécriture finale pour : " + contexte2.lieu);
        var articleFinal = reecritureFinaleLucasLunes(contexte2, contenuExistant);

        // Recalculer le compteur de mots et temps de lecture
        articleFinal = ajouterMetadonnees(articleFinal);

        // Sauvegarder la version finale dans Google Drive
        var articleFolder2 = creerDossierArticle(id);
        var titre2 = row[col["Titre"]];
        sauvegarderArticleMarkdown(articleFolder2, id, titre2, articleFinal);
        Logger.log("💾 Texte final sauvegardé dans Drive : " + DRIVE_FOLDER_NAME + "/" + id);

        ws.getRange(i + 1, col["Contenu Substack"] + 1).setValue(articleFinal);
        ws.getRange(i + 1, col["Notes"] + 1).setValue("Réécriture finale OK — " +
          Utilities.formatDate(new Date(), "Europe/Paris", "dd/MM/yyyy HH:mm") +
          "\nPour relancer une réécriture : effacer cette note et corriger le texte.");

        Logger.log("✅ Texte final généré : " + id);
        traite = true;
      } catch(e) {
        Logger.log("❌ Erreur réécriture " + id + " : " + e.toString());
        ws.getRange(i + 1, col["Notes"] + 1).setValue("Erreur réécriture : " + e.toString());
        traite = true;
      }
    }

    // ── À PUBLIER : photo Nanabana + sauvegarder fichiers + publier Substack ──
    if (statut === "À publier" && contenuExistant !== "") {
      Logger.log("🔄 Publication pour : " + id);
      try {
        ws.getRange(i + 1, col["Statut"] + 1).setValue("Publication en cours");
        SpreadsheetApp.flush();

        var titre   = row[col["Titre"]];
        var lieu    = row[col["Lieu"]];
        var contenu = contenuExistant;

        // 1. Créer le dossier article dans Google Drive
        var articleFolder = creerDossierArticle(id);

        // 2. Générer la photo Nanabana (Lucas Lunes sur le lieu)
        Logger.log("🎨 Génération photo Nanabana pour : " + lieu);
        genererPhotoNanabana(articleFolder, id, lieu);

        // 3. Télécharger photos Wikimedia → dossier article
        var contenuAvecPhotos = telechargerPhotosWikipedia(contenu, id, articleFolder);

        // 4. Sauvegarder l'article Markdown dans le dossier Drive
        sauvegarderArticleMarkdown(articleFolder, id, titre, contenuAvecPhotos);

        // 5. Publier sur Substack
        var result = posterSurSubstack(titre, contenuAvecPhotos);

        if (result.success) {
          ws.getRange(i + 1, col["Statut"] + 1).setValue("Publié");
          ws.getRange(i + 1, col["Notes"] + 1).setValue(
            "Publié le " + Utilities.formatDate(new Date(), "Europe/Paris", "dd/MM/yyyy HH:mm")
            + " | draft_id=" + result.draft_id
            + "\nDossier Drive : " + DRIVE_FOLDER_NAME + "/" + id
            + "\nPhoto Nanabana générée"
          );
          Logger.log("✅ Publié : " + id + " — " + titre);
        } else {
          ws.getRange(i + 1, col["Statut"] + 1).setValue("Erreur publication");
          ws.getRange(i + 1, col["Notes"] + 1).setValue("Erreur Substack : " + result.error);
          Logger.log("❌ Erreur publication : " + result.error);
        }
        traite = true;

      } catch(e) {
        Logger.log("❌ Erreur publication " + id + " : " + e.toString());
        ws.getRange(i + 1, col["Statut"] + 1).setValue("Erreur publication");
        ws.getRange(i + 1, col["Notes"] + 1).setValue("Erreur : " + e.toString());
        traite = true;
      }
    }
  }

  if (!traite) {
    Logger.log("✅ Rien à traiter — tous les articles sont à jour.");
  }
}

// ============================================================
// AJOUTER MÉTADONNÉES — Nombre de mots + temps de lecture
// ============================================================
function ajouterMetadonnees(article) {
  // Retirer l'ancienne ligne de métadonnées si elle existe
  article = article.replace(/\n*\*\d+ mots — .*lecture\*\n*/g, "\n");

  // Compter les mots (ignorer les balises markdown et les tags photo)
  var textepur = article.replace(/\[INSÉRER PHOTO[^\]]*\]/g, "")
                        .replace(/\[PHOTO LUCAS LUNES[^\]]*\]/g, "")
                        .replace(/[#*_\[\]()]/g, "")
                        .trim();
  var mots = textepur.split(/\s+/).filter(function(w) { return w.length > 0; }).length;

  // Temps de lecture (250 mots/minute)
  var minutes = Math.ceil(mots / 250);

  // Insérer après la première ligne (le titre)
  var lignes = article.split("\n");
  var titreLigne = 0;
  for (var l = 0; l < lignes.length; l++) {
    if (lignes[l].trim() !== "") {
      titreLigne = l;
      break;
    }
  }

  // Insérer les métadonnées après le titre
  lignes.splice(titreLigne + 1, 0, "", "*" + mots + " mots — " + minutes + " min de lecture*", "");

  return lignes.join("\n");
}

// ============================================================
// EXTRAIRE LE CONTEXTE D'UNE LIGNE
// ============================================================
function extraireContexte(row, col) {
  var lienArteviajero = row[col["Lien Arteviajero"]];
  var contenuBrut = "";
  if (lienArteviajero) {
    contenuBrut = scraperArteviajero(lienArteviajero);
  }

  return {
    id:                 String(row[col["ID"]]).trim(),
    titre:              row[col["Titre"]],
    lieu:               row[col["Lieu"]],
    lien:               lienArteviajero,
    motClePrincipal:    row[col["Mot-clé principal"]],
    motsClesSecondaires: row[col["Mots-clés secondaires"]],
    potentielSEO:       row[col["Potentiel SEO"]],
    figureHomme:        row[col["Figure ♂"]],
    figureFemme:        row[col["Figure ♀"]],
    figureReligieuse:   row[col["Figure ✝"]],
    angleEditorial:     row[col["Angle éditorial"]],
    planSuggere:        row[col["Plan suggéré"]],
    contenuBrut:        contenuBrut
  };
}

// ============================================================
// SCRAPER ARTEVIAJERO
// ============================================================
function scraperArteviajero(url) {
  if (!url || url.toString().trim() === "") return "";

  try {
    var response = UrlFetchApp.fetch(url, {
      muteHttpExceptions: true,
      headers: { "User-Agent": "LucasLunes-Editorial-Bot/1.0" }
    });

    if (response.getResponseCode() !== 200) {
      Logger.log("⚠️ Scraping échoué (" + response.getResponseCode() + ") : " + url);
      return "";
    }

    var html = response.getContentText();
    var contenu = "";

    var matchContent = html.match(/<div[^>]*class="[^"]*entry-content[^"]*"[^>]*>([\s\S]*?)<\/div>\s*<(?:footer|aside|nav|div[^>]*class="[^"]*(?:sidebar|comments|related))/i);
    if (matchContent) {
      contenu = matchContent[1];
    } else {
      var matchArticle = html.match(/<article[^>]*>([\s\S]*?)<\/article>/i);
      if (matchArticle) {
        contenu = matchArticle[1];
      } else {
        var matchBody = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
        if (matchBody) contenu = matchBody[1];
      }
    }

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
// RÉDACTION PREMIER JET — Claude Opus 4.6
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
    "STRUCTURE OBLIGATOIRE (CHAQUE SECTION EST NON-NÉGOCIABLE) :",
    "",
    "1. TITRE",
    "   Le titre de l'article sur une seule ligne, en # (Markdown H1).",
    "",
    "1b. SOUS-TITRE FIXE (OBLIGATOIRE — texte EXACT, identique dans CHAQUE article)",
    "    Immédiatement après le titre, sur la ligne suivante, en italique :",
    "    *Votre Chronique & Guide de voyages Ibérique Hebdomadaire*",
    "    Ce sous-titre est IDENTIQUE pour TOUS les articles. Ne JAMAIS le modifier.",
    "",
    "2. CHAPEAU (PREMIÈRE PHRASE OBLIGATOIRE — en italique)",
    "   Immédiatement après le titre, une phrase d'accroche en italique qui suit EXACTEMENT ce modèle :",
    "   *Ta chronique de voyage en [Espagne/Portugal] sur [le lieu], avec [figure principale] ([dates]) au temps de [contexte historique de l'époque], tandis que [événement contemporain dans un autre pays].*",
    "",
    "   EXEMPLE : *Ta chronique de voyage en Espagne sur le Monastère de Pedralbes, avec Elisenda de Montcada (1292-1364) au temps de la Couronne d'Aragon triomphante, tandis qu'en France Philippe VI de Valois monte sur un trône contesté.*",
    "",
    "   Cette phrase est SACRÉE. Elle doit toujours suivre cette construction. Elle ancre le lieu dans son époque ET dans l'actualité d'un autre pays à la même période.",
    "",
    "3. APPROCHE",
    "   L'arrivée au lieu. Ce que le voyageur voit, entend, ressent en s'approchant.",
    "   PAS de sous-titre. Le texte coule directement après le chapeau.",
    "",
    "4. LE LIEU COMME PERSONNAGE",
    "   Le lieu n'est pas un décor. Décris-le comme une personne : sa posture, ses silences, ses cicatrices.",
    "   PAS de sous-titre. Transition fluide depuis l'approche.",
    "",
    "5. TROIS VISITEURS — SCÈNES DE RENCONTRE (OBLIGATOIRE — NE JAMAIS OMETTRE)",
    "   Lucas croise exactement TROIS personnes au fil de sa visite. Chaque rencontre est une SCÈNE VIVANTE,",
    "   pas une simple mention. Chaque visiteur est introduit par ce qu'il FAIT quand Lucas le remarque.",
    "",
    "   VISITEUR 1 — LE LOCAL (celui qui connaît le lieu)",
    "   Un habitant, un gardien, un artisan, un ancien du village. Il est là depuis toujours.",
    "   Lucas le SURPREND en pleine action (il répare un mur, arrose des fleurs, observe le ciel, fume sur un banc…).",
    "   Il y a un ÉCHANGE : Lucas s'approche, pose une question ou fait un commentaire ; le local répond.",
    "   Son dialogue RÉVÈLE un secret, un souvenir, une anecdote sur le lieu que seul un habitant connaît.",
    "   MINIMUM 5 phrases dédiées à cette rencontre. Inclure : prénom, âge approximatif, un détail physique",
    "   (mains calleuses, chapeau usé, accent chantant…), le LIEU PRÉCIS dans le site où Lucas le croise.",
    "",
    "   VISITEUR 2 — LE VOYAGEUR (celui qui découvre comme le lecteur)",
    "   Un touriste, un randonneur, un couple, un photographe. Il vient d'ailleurs.",
    "   Lucas l'OBSERVE d'abord à distance — son comportement, sa façon de regarder le monument.",
    "   Puis un échange naît naturellement (ils commentent la même chose, partagent un banc, se croisent au même point de vue).",
    "   Son dialogue ou sa réaction reflète l'ÉMERVEILLEMENT ou la SURPRISE du visiteur extérieur.",
    "   CONTRASTE avec le local : lui ne connaît pas l'histoire, il la ressent autrement.",
    "   MINIMUM 5 phrases dédiées. Prénom, nationalité ou origine, détail vestimentaire, geste caractéristique.",
    "",
    "   VISITEUR 3 — L'INATTENDU (celui qui change la perspective)",
    "   Un enfant, un artiste, un pèlerin, un vieux couple, quelqu'un d'improbable dans ce lieu.",
    "   Sa présence SURPREND Lucas. Il ou elle fait quelque chose d'inattendu (dessine, prie, danse, pleure, rit…).",
    "   Cet échange ou cette observation apporte une ÉMOTION — c'est le moment de grâce de l'article.",
    "   Son dialogue (ou son silence éloquent) dit quelque chose de PROFOND sur le rapport humain au lieu.",
    "   MINIMUM 5 phrases dédiées. Prénom (ou description si le nom n'est pas échangé), détail marquant.",
    "",
    "   RÈGLES SCÉNIQUES :",
    "   - Les trois rencontres sont ESPACÉES dans le récit (début, milieu, fin de visite), PAS regroupées.",
    "   - Chaque scène a un DÉCOR précis : où exactement dans le site ? (le cloître, l'entrée, les ruines, le parvis…)",
    "   - Chaque scène a une ACTION : que fait le visiteur AVANT que Lucas ne l'aborde ?",
    "   - Chaque scène a un DIALOGUE : au moins 2 répliques échangées (question-réponse minimum).",
    "   - Chaque scène a un DÉPART : comment la rencontre se termine (il s'éloigne, Lucas reprend sa marche…).",
    "   - Les rencontres sont FICTIVES mais PLAUSIBLES. Pas de caricature.",
    "   PAS de sous-titre pour les visiteurs. Ils s'intègrent naturellement dans le flux du récit.",
    "",
    "6. COUCHES HISTORIQUES",
    "   Tisse le contenu historique du dossier de recherche dans la narration.",
    "   L'histoire émerge par un nom gravé, une anomalie architecturale, une réflexion.",
    "   Les femmes du dossier de recherche DOIVENT apparaître dans le récit.",
    "   PAS de sous-titre. L'histoire se mêle au récit.",
    "",
    "7. LÉGENDE LOCALE",
    "   SEULE section avec un sous-titre : ## Légende locale",
    "   Une légende ou tradition locale liée au lieu.",
    "   Encadrée comme récit oral : 'On raconte que…' ou 'Les anciens disent…'",
    "",
    "8. DÉPART",
    "   Terminer par le départ. Pas de conclusion ni de résumé.",
    "   Le sentiment de s'éloigner d'un lieu qui continuera d'exister sans toi.",
    "   PAS de sous-titre.",
    "",
    "9. SÉPARATEUR",
    "   Après le départ, insérer un séparateur horizontal :",
    "   ---",
    "",
    "10. QUESTION AU LECTEUR (OBLIGATOIRE)",
    "    Une question ouverte, contemplative, adressée directement au lecteur (tu).",
    "    Elle invite à la réflexion personnelle sur le thème de l'article.",
    "    En italique. Exemple : *Et toi, quel lieu t'a déjà parlé sans prononcer un mot ?*",
    "",
    "11. INVITATION À LA NEWSLETTER (OBLIGATOIRE — texte EXACT à reproduire)",
    "    Reproduire EXACTEMENT ce bloc :",
    "",
    "    ---",
    "",
    "    **Tu veux recevoir chaque semaine une nouvelle chronique de Lucas Lunes ?**",
    "    Abonne-toi gratuitement et rejoins les voyageurs qui écoutent les pierres.",
    "",
    "12. SIGNATURE (OBLIGATOIRE — texte EXACT à reproduire)",
    "    Terminer EXACTEMENT par :",
    "",
    "    *Lucas Lunes*",
    "    *Quelque part entre deux pierres*",
    "",
    "13. HASHTAGS SEO (OBLIGATOIRE — DERNIÈRE LIGNE DE L'ARTICLE)",
    "    IMMÉDIATEMENT après la signature, ajouter UNE LIGNE VIDE puis UNE SEULE LIGNE avec les hashtags.",
    "    Prendre le mot-clé principal et les mots-clés secondaires fournis dans les données.",
    "    Les transformer en hashtags CamelCase sans espaces ni accents.",
    "    Format exact : #MotCle1 #MotCle2 #MotCle3 #MotCle4 #MotCle5",
    "    Exemple : si mot-clé principal = 'mines romaines' et secondaires = 'patrimoine UNESCO, León, or romain, paysage culturel'",
    "    → #MinesRomaines #PatrimoineUnesco #Leon #OrRomain #PaysageCulturel",
    "    Cette ligne de hashtags est la TOUTE DERNIÈRE chose de l'article. RIEN après.",
    "",
    "RÈGLES STRICTES :",
    "- AUCUNE duplication du texte source ou du dossier de recherche.",
    "- AUCUNE liste encyclopédique de dates ou dimensions.",
    "- AUCUN marqueur IA : 'En conclusion', 'Il convient de noter', 'En effet'.",
    "- AUCUNE description générique — chaque phrase est spécifique à CE lieu.",
    "- Rigueur historique : tous les faits viennent du dossier de recherche.",
    "- Longueur : MINIMUM 1800 mots, idéalement 2000–2500 mots.",
    "- Langue : français.",
    "- Format : texte narratif FLUIDE. PAS de sous-titres ## dans le corps du texte.",
    "- SEULE EXCEPTION : ## Légende locale est le seul sous-titre autorisé dans le corps.",
    "- Le texte doit couler comme un récit continu, pas comme un article structuré avec des sections.",
    "- PAS de gras ** dans le corps du texte sauf pour un nom propre cité pour la première fois.",
    "- Les sections 9 à 13 (séparateur, question, invitation, signature, hashtags) sont NON-NÉGOCIABLES.",
    "- Si tu oublies les trois visiteurs, la question, l'invitation, la signature ou les hashtags, l'article est REJETÉ.",
    "",
    "PHOTOS WIKIMEDIA (OBLIGATOIRE — DANS LE CORPS DU TEXTE) :",
    "- Insérer 2 à 4 photos Wikimedia Commons DIRECTEMENT dans le texte, aux endroits pertinents.",
    "- Chaque photo est insérée là où elle enrichit le récit (ex: après avoir décrit un cloître, insérer la photo du cloître).",
    "- Format EXACT de chaque insertion :",
    "  [INSÉRER PHOTO N — description : https://commons.wikimedia.org/wiki/File:NomDuFichier.jpg]",
    "- Les noms de fichiers Wikimedia DOIVENT être des fichiers qui existent réellement sur Commons.",
    "- NE PAS regrouper les photos en fin d'article. Elles sont DISPERSÉES dans le texte."
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
    "COMMENCE par le titre en # puis IMMÉDIATEMENT le chapeau en italique.",
    "Le chapeau suit EXACTEMENT le modèle : *Ta chronique de voyage en [pays] sur [lieu], avec [figure] ([dates]) au temps de [contexte], tandis que [événement contemporain ailleurs].*",
    "Ensuite le texte coule SANS sous-titres, sauf ## Légende locale.",
    "MINIMUM 1800 mots.",
    "",
    "CHECKLIST OBLIGATOIRE — ton article DOIT contenir TOUS ces éléments :",
    "☐ Sous-titre fixe : *Votre Chronique & Guide de voyages Ibérique Hebdomadaire* (juste après le titre)",
    "☐ Chapeau en italique (modèle exact)",
    "☐ 2-4 photos Wikimedia insérées DANS le corps du texte aux endroits pertinents",
    "☐ TROIS visiteurs avec prénoms, dialogues, détails physiques (3+ phrases chacun)",
    "☐ Section ## Légende locale",
    "☐ Figures féminines du dossier de recherche tissées dans le récit",
    "☐ Scène de départ",
    "☐ Séparateur ---",
    "☐ Question au lecteur en italique",
    "☐ Séparateur ---",
    "☐ Invitation newsletter : **Tu veux recevoir chaque semaine une nouvelle chronique de Lucas Lunes ?** + Abonne-toi gratuitement et rejoins les voyageurs qui écoutent les pierres.",
    "☐ Signature : *Lucas Lunes* + *Quelque part entre deux pierres*",
    "☐ Hashtags SEO (mot-clé principal + mots-clés secondaires en #CamelCase)",
    "",
    "Si un seul de ces éléments manque, l'article est REJETÉ."
  ].join("\n");

  return appelClaude(systemPrompt, userPrompt, 0.7, 8000);
}

// ============================================================
// RÉÉCRITURE FINALE — Claude Opus 4.6
// ============================================================
function reecritureFinaleLucasLunes(contexte, brouillonCorrige) {
  var systemPrompt = [
    "Tu es Lucas Lunes. Tu reçois un brouillon d'article que tu as écrit,",
    "qui a été corrigé et annoté par l'éditeur humain.",
    "",
    "Ta mission : réécrire l'article en version finale en tenant compte",
    "de TOUTES les corrections et modifications de l'éditeur.",
    "",
    "RÈGLES DE STYLE :",
    "- Respecter chaque correction de l'éditeur sans exception.",
    "- Conserver ta voix Lucas Lunes (intime, contemplative, sans hâte).",
    "- Polir le style : fluidité, rythme, transitions.",
    "- Corriger toute maladresse restante.",
    "- Le chapeau en italique doit rester en première position après le titre.",
    "- Il doit suivre le modèle : *Ta chronique de voyage en [pays] sur [lieu], avec [figure] ([dates]) au temps de [contexte], tandis que [événement contemporain ailleurs].*",
    "- PAS de sous-titres ## dans le corps du texte, SAUF ## Légende locale.",
    "- Le texte doit couler comme un récit continu.",
    "- MINIMUM 1800 mots.",
    "- Format : Markdown propre.",
    "- AUCUN marqueur IA.",
    "- Conserver les balises [INSÉRER PHOTO] telles quelles.",
    "",
    "ÉLÉMENTS STRUCTURELS OBLIGATOIRES (vérifier que TOUS sont présents, les AJOUTER s'ils manquent) :",
    "",
    "1. TROIS VISITEURS — SCÈNES DE RENCONTRE — L'article DOIT contenir exactement 3 visiteurs",
    "   qui sont de VRAIES SCÈNES VIVANTES, pas de simples mentions.",
    "   - VISITEUR 1 (LE LOCAL) : habitant/gardien/artisan, surpris en pleine action, dialogue qui révèle un secret du lieu.",
    "   - VISITEUR 2 (LE VOYAGEUR) : touriste/randonneur, observé puis abordé, dialogue d'émerveillement, contraste avec le local.",
    "   - VISITEUR 3 (L'INATTENDU) : présence surprenante, moment de grâce, émotion profonde.",
    "   Chaque rencontre : MINIMUM 5 phrases, un décor précis dans le site, une action avant l'échange,",
    "   au moins 2 répliques de dialogue, un départ (il s'éloigne, Lucas reprend sa marche).",
    "   Les 3 rencontres sont ESPACÉES dans le récit (début, milieu, fin), PAS regroupées.",
    "   Si le brouillon n'en contient pas 3, ou si les visiteurs sont plats/mentionnés en passant,",
    "   tu DOIS les réécrire comme des scènes de rencontre complètes.",
    "",
    "2. SECTION ## Légende locale — Doit être présente avec ce sous-titre exact.",
    "",
    "3. FIN DE L'ARTICLE — Après le paragraphe de départ, l'article DOIT se terminer par :",
    "",
    "   ---",
    "",
    "   *[Question contemplative au lecteur, en italique, qui invite à la réflexion personnelle]*",
    "",
    "   ---",
    "",
    "   **Tu veux recevoir chaque semaine une nouvelle chronique de Lucas Lunes ?**",
    "   Abonne-toi gratuitement et rejoins les voyageurs qui écoutent les pierres.",
    "",
    "   *Lucas Lunes*",
    "   *Quelque part entre deux pierres*",
    "",
    "Si le brouillon ne contient pas ces éléments de fin, tu DOIS les ajouter.",
    "L'invitation à la newsletter et la signature sont des textes EXACTS à reproduire mot pour mot.",
    "",
    "4. PHOTOS WIKIMEDIA — Les balises [INSÉRER PHOTO] doivent rester dans le CORPS du texte,",
    "   aux endroits pertinents (pas regroupées en fin). Si elles sont regroupées en fin, les redistribuer.",
    "   Conserver le format exact : [INSÉRER PHOTO N — description : https://commons.wikimedia.org/wiki/File:...]",
    "",
    "5. HASHTAGS SEO — Après la signature, ajouter les hashtags SEO.",
    "   Utiliser le mot-clé principal et les mots-clés secondaires en format #CamelCase.",
    "   Si le brouillon n'en contient pas, les AJOUTER.",
    "",
    "Le résultat doit être un texte PUBLIABLE, prêt pour Substack."
  ].join("\n");

  var userPrompt = [
    "LIEU : " + contexte.lieu,
    "TITRE : " + contexte.titre,
    "MOT-CLÉ PRINCIPAL : " + (contexte.motClePrincipal || ""),
    "MOTS-CLÉS SECONDAIRES : " + (contexte.motsClesSecondaires || ""),
    "",
    "BROUILLON CORRIGÉ PAR L'ÉDITEUR :",
    brouillonCorrige,
    "",
    "Réécris l'article en version finale publiable.",
    "Intègre toutes les corrections de l'éditeur.",
    "Polis le style et la fluidité.",
    "MINIMUM 1800 mots.",
    "",
    "CHECKLIST — vérifie que l'article final contient TOUS ces éléments :",
    "☐ Sous-titre fixe : *Votre Chronique & Guide de voyages Ibérique Hebdomadaire* (juste après le titre)",
    "☐ Chapeau en italique (modèle exact)",
    "☐ 2-4 photos Wikimedia insérées DANS le corps du texte (pas regroupées en fin)",
    "☐ TROIS visiteurs avec prénoms, dialogues, détails (3+ phrases chacun)",
    "☐ Section ## Légende locale",
    "☐ Scène de départ",
    "☐ Séparateur ---",
    "☐ Question au lecteur en italique",
    "☐ Séparateur ---",
    "☐ Invitation newsletter (texte exact)",
    "☐ Signature Lucas Lunes (texte exact)",
    "☐ Hashtags SEO (#CamelCase après la signature)"
  ].join("\n");

  return appelClaude(systemPrompt, userPrompt, 0.5, 8000);
}

// ============================================================
// GÉNÉRER PHOTO NANABANA — Lucas Lunes sur le lieu
// Utilise l'API Google Gemini avec la photo de référence
// ============================================================
function genererPhotoNanabana(articleFolder, articleId, lieu) {
  try {
    // 1. Télécharger la photo de référence de Lucas Lunes depuis Drive
    var refFile = DriveApp.getFileById(LUCAS_LUNES_PHOTO_ID);
    var refBlob = refFile.getBlob();
    var refBase64 = Utilities.base64Encode(refBlob.getBytes());
    var refMimeType = refBlob.getContentType();

    // 2. Construire le prompt avec le lieu
    var prompt = NANABANA_BASE_PROMPT.replace("{{LIEU}}", lieu);

    // 3. Appeler l'API Gemini avec image de référence + prompt
    var payload = {
      "contents": [
        {
          "parts": [
            {
              "inlineData": {
                "mimeType": refMimeType,
                "data": refBase64
              }
            },
            {
              "text": prompt
            }
          ]
        }
      ],
      "generationConfig": {
        "responseModalities": ["IMAGE", "TEXT"],
        "temperature": 0.4
      }
    };

    var options = {
      method: "post",
      contentType: "application/json",
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    };

    var apiUrl = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent?key=" + GOOGLE_API_KEY;
    var response = UrlFetchApp.fetch(apiUrl, options);
    var code = response.getResponseCode();
    var body = response.getContentText();

    if (code !== 200) {
      Logger.log("⚠️ Nanabana API erreur HTTP " + code + " : " + body.substring(0, 300));
      return null;
    }

    var json = JSON.parse(body);

    // 4. Extraire l'image générée de la réponse
    var candidates = json.candidates;
    if (!candidates || !candidates[0] || !candidates[0].content || !candidates[0].content.parts) {
      Logger.log("⚠️ Réponse Nanabana sans image : " + body.substring(0, 300));
      return null;
    }

    var parts = candidates[0].content.parts;
    var imageData = null;
    var imageMimeType = "image/png";

    for (var p = 0; p < parts.length; p++) {
      if (parts[p].inlineData) {
        imageData = parts[p].inlineData.data;
        imageMimeType = parts[p].inlineData.mimeType || "image/png";
        break;
      }
    }

    if (!imageData) {
      Logger.log("⚠️ Pas d'image dans la réponse Nanabana");
      return null;
    }

    // 5. Sauvegarder l'image dans le dossier article
    var extension = imageMimeType === "image/jpeg" ? ".jpg" : ".png";
    var filename = articleId + "_nanabana_lucas_lunes" + extension;

    var decoded = Utilities.base64Decode(imageData);
    var blob = Utilities.newBlob(decoded, imageMimeType, filename);
    var file = articleFolder.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

    Logger.log("🎨 Photo Nanabana générée et sauvée : " + filename);
    return "https://drive.google.com/uc?id=" + file.getId();

  } catch(e) {
    Logger.log("❌ Erreur Nanabana : " + e.toString());
    return null;
  }
}

// ============================================================
// CRÉER DOSSIER ARTICLE — Google Drive
// ============================================================
function creerDossierArticle(articleId) {
  var root = DriveApp.getRootFolder();
  var parentFolders = root.getFoldersByName(DRIVE_FOLDER_NAME);
  var parentFolder;
  if (parentFolders.hasNext()) {
    parentFolder = parentFolders.next();
  } else {
    parentFolder = root.createFolder(DRIVE_FOLDER_NAME);
  }

  var articleFolders = parentFolder.getFoldersByName(articleId);
  if (articleFolders.hasNext()) {
    return articleFolders.next();
  }
  var articleFolder = parentFolder.createFolder(articleId);
  Logger.log("📁 Dossier créé dans Drive : " + DRIVE_FOLDER_NAME + "/" + articleId);
  return articleFolder;
}

// ============================================================
// SAUVEGARDER ARTICLE MARKDOWN
// ============================================================
function sauvegarderArticleMarkdown(folder, articleId, titre, contenu) {
  var filename = articleId + " — " + titre.replace(/[\/\\:*?"<>|]/g, "-") + ".md";

  var existingFiles = folder.getFilesByName(filename);
  while (existingFiles.hasNext()) {
    existingFiles.next().setTrashed(true);
  }

  var blob = Utilities.newBlob(contenu, "text/markdown", filename);
  folder.createFile(blob);
  Logger.log("💾 Article sauvegardé : " + filename);
}

// ============================================================
// TÉLÉCHARGER PHOTOS WIKIPEDIA → dossier article Drive
// ============================================================
function telechargerPhotosWikipedia(contenu, articleId, folder) {
  var regex    = /\[INSÉRER PHOTO \d+ — [^\]]*: (https:\/\/commons\.wikimedia\.org\/wiki\/File:[^\]]+)\]/g;
  var match;
  var resultat = contenu;

  while ((match = regex.exec(contenu)) !== null) {
    var fullTag  = match[0];
    var wikiUrl  = match[1];
    var filename = wikiUrl.split("File:")[1];

    try {
      var imageUrl = obtenirUrlDirecteWikimedia(filename);
      if (!imageUrl) { Logger.log("⚠️ URL introuvable pour : " + filename); continue; }

      var response = UrlFetchApp.fetch(imageUrl, {muteHttpExceptions: true});
      if (response.getResponseCode() !== 200) {
        Logger.log("⚠️ Téléchargement échoué (" + response.getResponseCode() + ") : " + filename);
        continue;
      }

      var blob = response.getBlob().setName(articleId + "_" + filename);
      var file = folder.createFile(blob);
      file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      var driveUrl = "https://drive.google.com/uc?id=" + file.getId();

      resultat = resultat.replace(fullTag, driveUrl);
      Logger.log("✅ Photo sauvée : " + filename);

    } catch(e) {
      Logger.log("❌ Erreur photo " + filename + " : " + e.toString());
    }
  }
  return resultat;
}

function obtenirUrlDirecteWikimedia(filename) {
  // Décoder d'abord si déjà encodé (ex: %C3%A9 → é), puis ré-encoder proprement
  var decodedFilename;
  try {
    decodedFilename = decodeURIComponent(filename);
  } catch(e) {
    decodedFilename = filename;
  }
  var apiUrl = "https://commons.wikimedia.org/w/api.php?action=query&titles=File:"
    + encodeURIComponent(decodedFilename) + "&prop=imageinfo&iiprop=url&format=json";
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
// RÉCUPÉRER L'ID UTILISATEUR SUBSTACK
// ============================================================
function obtenirSubstackUserId() {
  // Essayer plusieurs endpoints connus pour récupérer le user ID
  var endpoints = [
    "https://substack.com/api/v1/user/profile/self",
    "https://lucienmoons.substack.com/api/v1/user/profile/self",
    "https://lucienmoons.substack.com/api/v1/me"
  ];

  for (var e = 0; e < endpoints.length; e++) {
    try {
      var options = {
        method: "get",
        headers: {"Cookie": SUBSTACK_COOKIE, "User-Agent": "Mozilla/5.0"},
        muteHttpExceptions: true
      };
      var response = UrlFetchApp.fetch(endpoints[e], options);
      var code = response.getResponseCode();

      if (code === 200) {
        var data = JSON.parse(response.getContentText());
        var userId = data.id || (data.user && data.user.id) || null;
        if (userId) {
          Logger.log("✅ Substack user ID récupéré : " + userId + " (via " + endpoints[e] + ")");
          return userId;
        }
      }
      Logger.log("⚠️ Endpoint " + endpoints[e] + " : HTTP " + code);
    } catch(err) {
      Logger.log("⚠️ Erreur endpoint " + endpoints[e] + " : " + err.toString());
    }
  }

  Logger.log("❌ Impossible de récupérer le user ID Substack — cookie expiré ?");
  return null;
}

// ============================================================
// POSTER SUR SUBSTACK
// ============================================================
function posterSurSubstack(titre, contenu) {
  if (!SUBSTACK_COOKIE) {
    return {success: false, error: "SUBSTACK_COOKIE non configuré"};
  }

  var userId = obtenirSubstackUserId();
  if (!userId) {
    return {success: false, error: "Impossible de récupérer le user ID Substack — cookie expiré ?"};
  }

  var bodyJson = convertirMarkdownEnSubstackJson(contenu);
  var payload = JSON.stringify({
    "draft_title": titre,
    "draft_subtitle": "",
    "draft_body": JSON.stringify(bodyJson),
    "draft_bylines": [{"id": userId, "is_guest": false}],
    "section_chosen": false,
    "type": "newsletter"
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
// CONVERTIR MARKDOWN → SUBSTACK JSON (ProseMirror)
// ============================================================
function convertirMarkdownEnSubstackJson(texte) {
  if (!texte) return {"type": "doc", "content": [{"type": "paragraph"}]};

  // Retirer le titre H1 (déjà dans draft_title de Substack)
  texte = texte.replace(/^# .+$/m, "");

  // Retirer la ligne métadonnées (mots / temps de lecture)
  texte = texte.replace(/^\*\d+ mots — .+lecture\*$/m, "");

  // Retirer les tags photo non résolus
  texte = texte.replace(/\[INSÉRER PHOTO \d+[^\]]*\]/g, "");
  texte = texte.replace(/\[PHOTO LUCAS LUNES[^\]]*PLACEHOLDER\]/g, "");

  // Découper en blocs (double saut de ligne)
  var blocs = texte.split(/\n\n+/).map(function(b) { return b.trim(); }).filter(function(b) { return b !== ""; });
  var content = [];

  for (var b = 0; b < blocs.length; b++) {
    var bloc = blocs[b];

    // Séparateur horizontal
    if (bloc === "---") {
      content.push({"type": "horizontal_rule"});
      continue;
    }

    // Sous-titre H2
    var h2Match = bloc.match(/^## (.+)$/);
    if (h2Match) {
      content.push({
        "type": "heading",
        "attrs": {"level": 2},
        "content": parserInline(h2Match[1])
      });
      continue;
    }

    // Image Drive URL seule sur une ligne
    var imgMatch = bloc.match(/^(https:\/\/drive\.google\.com\/uc\?id=[^\s]+)$/);
    if (imgMatch) {
      content.push({
        "type": "captionedImage",
        "attrs": {"src": imgMatch[1], "fullscreen": false, "imageSize": "normal"}
      });
      continue;
    }

    // Image avec tag PHOTO LUCAS LUNES
    var photoMatch = bloc.match(/\[PHOTO LUCAS LUNES[^\]]*: (https?:\/\/[^\]]+)\]/);
    if (photoMatch) {
      content.push({
        "type": "captionedImage",
        "attrs": {"src": photoMatch[1], "fullscreen": false, "imageSize": "normal"}
      });
      continue;
    }

    // Paragraphe normal — parser le contenu inline (gras, italique, liens)
    var inlineContent = parserInline(bloc);
    if (inlineContent.length > 0) {
      content.push({"type": "paragraph", "content": inlineContent});
    }
  }

  if (content.length === 0) {
    content.push({"type": "paragraph"});
  }

  return {"type": "doc", "content": content};
}

// ============================================================
// PARSER INLINE — Gras, italique, liens dans un texte
// ============================================================
function parserInline(texte) {
  // Remplacer les sauts de ligne simples par des espaces
  texte = texte.replace(/\n/g, " ");

  var nodes = [];
  var regex = /(\*\*([^*]+)\*\*)|(\*([^*]+)\*)|(\[([^\]]+)\]\((https?:\/\/[^\)]+)\))/g;
  var lastIndex = 0;
  var match;

  while ((match = regex.exec(texte)) !== null) {
    // Texte avant le match
    if (match.index > lastIndex) {
      var before = texte.substring(lastIndex, match.index);
      if (before) nodes.push({"type": "text", "text": before});
    }

    if (match[1]) {
      // Gras **texte**
      nodes.push({"type": "text", "text": match[2], "marks": [{"type": "bold"}]});
    } else if (match[3]) {
      // Italique *texte*
      nodes.push({"type": "text", "text": match[4], "marks": [{"type": "italic"}]});
    } else if (match[5]) {
      // Lien [texte](url)
      nodes.push({
        "type": "text", "text": match[6],
        "marks": [{"type": "link", "attrs": {"href": match[7]}}]
      });
    }

    lastIndex = regex.lastIndex;
  }

  // Texte restant après le dernier match
  if (lastIndex < texte.length) {
    var remaining = texte.substring(lastIndex);
    if (remaining) nodes.push({"type": "text", "text": remaining});
  }

  return nodes;
}

// ============================================================
// APPEL CLAUDE OPUS 4.6 — API Anthropic
// ============================================================
function appelClaude(systemPrompt, userPrompt, temperature, maxTokens) {
  if (!ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY non configuré.");
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

  var maxRetries = 3;
  var retryDelay = 5000; // 5 secondes

  for (var attempt = 0; attempt <= maxRetries; attempt++) {
    var response = UrlFetchApp.fetch("https://api.anthropic.com/v1/messages", options);
    var code = response.getResponseCode();
    var body = response.getContentText();

    if (code === 529 || code === 503) {
      Logger.log("⏳ Claude API surchargée (HTTP " + code + "), tentative " + (attempt + 1) + "/" + (maxRetries + 1));
      if (attempt < maxRetries) {
        Utilities.sleep(retryDelay * (attempt + 1));
        continue;
      }
      throw new Error("Claude API surchargée après " + (maxRetries + 1) + " tentatives.");
    }

    if (code !== 200) {
      throw new Error("Claude API erreur HTTP " + code + " : " + body.substring(0, 300));
    }

    var json = JSON.parse(body);
    if (!json.content || !json.content[0] || !json.content[0].text) {
      throw new Error("Réponse Claude inattendue : " + body.substring(0, 300));
    }

    return json.content[0].text;
  }
}

// ============================================================
// CRAWLER ARTEVIAJERO — Récupérer les URLs d'articles
// ============================================================
var ARTEVIAJERO_INDEX_PAGES = [
  "https://arteviajero.com/articulos/",
  "https://arteviajero.com/articulos/page/2/",
  "https://arteviajero.com/articulos/page/3/",
  "https://arteviajero.com/articulos/page/4/",
  "https://arteviajero.com/articulos/page/5/",
  "https://arteviajero.com/articulos/page/6/",
  "https://arteviajero.com/articulos/page/7/",
  "https://arteviajero.com/articulos/page/8/",
  "https://arteviajero.com/articulos/page/9/",
  "https://arteviajero.com/articulos/page/10/"
];

function crawlerArteviajero() {
  var allUrls = [];

  for (var p = 0; p < ARTEVIAJERO_INDEX_PAGES.length; p++) {
    try {
      var response = UrlFetchApp.fetch(ARTEVIAJERO_INDEX_PAGES[p], {
        muteHttpExceptions: true,
        headers: {"User-Agent": "LucasLunes-Editorial-Bot/1.0"}
      });

      if (response.getResponseCode() !== 200) {
        Logger.log("⚠️ Page index " + (p + 1) + " : HTTP " + response.getResponseCode());
        break; // Plus de pages
      }

      var html = response.getContentText();
      // Extraire les liens vers les articles individuels
      var regex = /href="(https:\/\/arteviajero\.com\/articulos\/[^"\/]+\/?)">/g;
      var match;
      while ((match = regex.exec(html)) !== null) {
        var url = match[1].replace(/\/$/, ""); // Normaliser sans trailing slash
        if (allUrls.indexOf(url) === -1) {
          allUrls.push(url);
        }
      }

      Logger.log("📄 Page index " + (p + 1) + " : " + allUrls.length + " articles trouvés au total");

    } catch(e) {
      Logger.log("❌ Erreur crawl page " + (p + 1) + " : " + e.toString());
      break;
    }
  }

  Logger.log("🔍 Total articles trouvés sur Arteviajero : " + allUrls.length);
  return allUrls;
}

// ============================================================
// GÉNÉRER 5 PROCHAINS ARTICLES — Depuis Arteviajero
// ============================================================
function genererProchainSujets() {
  var ss      = SpreadsheetApp.openById(SPREADSHEET_ID);
  var ws      = ss.getSheetByName(SHEET_NAME);
  var data    = ws.getDataRange().getValues();
  var headers = data[0];

  var col = {};
  for (var h = 0; h < headers.length; h++) {
    col[headers[h]] = h;
  }

  // 1. Collecter les liens Arteviajero déjà dans la feuille
  var existingIds = [];
  var existingLinks = [];
  for (var i = 1; i < data.length; i++) {
    var idCell = String(data[i][col["ID"]] || "").trim();
    if (idCell) existingIds.push(idCell);
    var linkCell = String(data[i][col["Lien Arteviajero"]] || "").trim().replace(/\/$/, "");
    if (linkCell) existingLinks.push(linkCell);
  }

  Logger.log("📋 Articles déjà dans la feuille : " + existingLinks.length);

  // 2. Crawler Arteviajero pour trouver tous les articles
  Logger.log("🔍 Crawl d'Arteviajero en cours…");
  var allUrls = crawlerArteviajero();

  // 3. Filtrer : ne garder que les articles PAS encore dans la feuille
  var newUrls = [];
  for (var u = 0; u < allUrls.length; u++) {
    var normalized = allUrls[u].replace(/\/$/, "");
    if (existingLinks.indexOf(normalized) === -1) {
      newUrls.push(normalized);
    }
  }

  Logger.log("🆕 Articles non encore couverts : " + newUrls.length);

  if (newUrls.length === 0) {
    Logger.log("⚠️ Aucun nouvel article trouvé sur Arteviajero");
    SpreadsheetApp.getUi().alert("Aucun nouvel article trouvé sur Arteviajero qui ne soit pas déjà dans la feuille.");
    return;
  }

  // 4. Prendre les 5 premiers nouveaux articles
  var toProcess = newUrls.slice(0, 5);

  // 5. Déterminer les prochains IDs
  var lastId = existingIds[existingIds.length - 1] || "";
  var weekMatch = lastId.match(/(\d{4})-W(\d{2})-(\d{2})/);
  var year = new Date().getFullYear();
  var nextWeek, nextNum;

  if (weekMatch) {
    var lastWeek = parseInt(weekMatch[2]);
    var lastNum  = parseInt(weekMatch[3]);
    if (lastNum >= 5) {
      nextWeek = lastWeek + 1;
      nextNum  = 1;
    } else {
      nextWeek = lastWeek;
      nextNum  = lastNum + 1;
    }
  } else {
    var now = new Date();
    var janFirst = new Date(now.getFullYear(), 0, 1);
    nextWeek = Math.ceil((((now - janFirst) / 86400000) + janFirst.getDay() + 1) / 7);
    nextNum  = 1;
  }

  var newIds = [];
  var currentNum = nextNum;
  var currentWeek = nextWeek;
  for (var n = 0; n < toProcess.length; n++) {
    if (currentNum > 5) {
      currentWeek++;
      currentNum = 1;
    }
    var wStr = String(currentWeek).length < 2 ? "0" + currentWeek : String(currentWeek);
    newIds.push(year + "-W" + wStr + "-0" + currentNum);
    currentNum++;
  }

  Logger.log("🔄 Traitement de " + toProcess.length + " articles : " + newIds.join(", "));

  // 6. Pour chaque article : scraper le contenu, puis Claude extrait les métadonnées
  var today = Utilities.formatDate(new Date(), "Europe/Paris", "dd/MM/yyyy");

  for (var a = 0; a < toProcess.length; a++) {
    var articleUrl = toProcess[a];
    var articleId  = newIds[a];

    Logger.log("📖 Scraping : " + articleUrl);
    var contenuBrut = scraperArteviajero(articleUrl);

    if (!contenuBrut || contenuBrut.length < 100) {
      Logger.log("⚠️ Contenu trop court pour : " + articleUrl);
      continue;
    }

    // Extraire le titre de l'URL comme fallback
    var slugTitre = articleUrl.split("/articulos/")[1] || "";
    slugTitre = slugTitre.replace(/-/g, " ").replace(/\/$/, "");

    Logger.log("🤖 Analyse Claude pour : " + slugTitre);

    var systemPrompt = [
      "Tu es le directeur éditorial de Lucas Lunes, newsletter sur le patrimoine ibérique.",
      "On te donne le contenu scrapé d'un article d'Arteviajero.",
      "Tu dois extraire les informations éditoriales pour produire un article Lucas Lunes.",
      "",
      "RÉPONDS UNIQUEMENT en JSON, un seul objet :",
      "{",
      "  \"titre\": \"Titre Lucas Lunes en français (pas le titre original)\",",
      "  \"lieu\": \"Nom du lieu, Ville, Pays\",",
      "  \"mot_cle_principal\": \"mot-clé SEO en français\",",
      "  \"mots_cles_secondaires\": \"3-5 mots-clés séparés par virgules\",",
      "  \"potentiel_seo\": 3,",
      "  \"figure_homme\": \"Nom (dates) — rôle historique lié au lieu\",",
      "  \"figure_femme\": \"Nom (dates) — rôle (OBLIGATOIRE, chercher une femme liée au lieu)\",",
      "  \"figure_religieuse\": \"Nom ou ordre religieux lié au lieu\",",
      "  \"angle_editorial\": \"L'angle narratif Lucas Lunes en une phrase\",",
      "  \"plan_suggere\": \"3-4 lignes : moments clés du récit\"",
      "}",
      "",
      "RÈGLES :",
      "- Le titre doit être évocateur, style Lucas Lunes (pas encyclopédique).",
      "- Toujours identifier une figure féminine, même si le contenu n'en mentionne pas explicitement.",
      "- L'angle éditorial doit refléter la voix Lucas Lunes : contemplative, intime.",
      "- Potentiel SEO de 1 à 5.",
      "- JSON UNIQUEMENT, pas de texte avant ni après."
    ].join("\n");

    var userPrompt = [
      "URL source : " + articleUrl,
      "Slug : " + slugTitre,
      "",
      "CONTENU SCRAPÉ :",
      contenuBrut.substring(0, 6000),
      "",
      "Extrais les métadonnées éditoriales. JSON uniquement."
    ].join("\n");

    try {
      var response = appelClaude(systemPrompt, userPrompt, 0.5, 2000);

      var jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        Logger.log("❌ JSON non trouvé pour : " + articleUrl);
        continue;
      }

      var sujet = JSON.parse(jsonMatch[0]);

      // Insérer la ligne dans la feuille
      var newRow = [];
      for (var c = 0; c < headers.length; c++) {
        newRow.push("");
      }

      newRow[col["ID"]]                    = articleId;
      newRow[col["Date"]]                  = today;
      newRow[col["Titre"]]                 = sujet.titre || slugTitre;
      newRow[col["Lieu"]]                  = sujet.lieu || "";
      newRow[col["Lien Arteviajero"]]      = articleUrl;
      newRow[col["Mot-clé principal"]]      = sujet.mot_cle_principal || "";
      newRow[col["Mots-clés secondaires"]]  = sujet.mots_cles_secondaires || "";
      newRow[col["Potentiel SEO"]]          = sujet.potentiel_seo || 3;
      newRow[col["Figure ♂"]]              = sujet.figure_homme || "";
      newRow[col["Figure ♀"]]              = sujet.figure_femme || "";
      newRow[col["Figure ✝"]]              = sujet.figure_religieuse || "";
      newRow[col["Angle éditorial"]]        = sujet.angle_editorial || "";
      newRow[col["Plan suggéré"]]           = sujet.plan_suggere || "";
      newRow[col["Statut"]]                 = "À vérifier";

      ws.appendRow(newRow);
      SpreadsheetApp.flush();
      Logger.log("✅ Ajouté : " + articleId + " — " + (sujet.titre || slugTitre));

    } catch(e) {
      Logger.log("❌ Erreur traitement " + articleUrl + " : " + e.toString());
    }
  }

  Logger.log("✅ Nouveaux sujets ajoutés au pipeline !");
  SpreadsheetApp.getUi().alert("Nouveaux sujets Arteviajero ajoutés !\n\nVérifiez les titres et passez-les en 'Brouillon' pour lancer la rédaction.");
}

// ============================================================
// TRIGGER — Vérifier toutes les 5 minutes
// ============================================================
function configurerTrigger() {
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === "traiterPipeline") {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }
  ScriptApp.newTrigger("traiterPipeline")
    .timeBased().everyMinutes(5).create();
  Logger.log("✅ Trigger configuré : traiterPipeline toutes les 5 minutes");
}

// ============================================================
// MENU PERSONNALISÉ
// ============================================================
function onOpen() {
  var ui = SpreadsheetApp.getUi();
  ui.createMenu("🖊️ Lucas Lunes")
    .addItem("Générer 5 prochains sujets", "genererProchainSujets")
    .addSeparator()
    .addItem("Traiter le pipeline maintenant", "traiterPipeline")
    .addItem("Configurer le trigger automatique (5 min)", "configurerTrigger")
    .addToUi();
}