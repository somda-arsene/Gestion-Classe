/**
 * Script de vérification des codes d'activation - Gestion-Classe
 * ------------------------------------------------------------
 * Feuille "Clients" (3 colonnes) :
 *   Colonne A : Email
 *   Colonne B : Code
 *   Colonne C : Ecole
 *
 * Feuille "Connexions" (à créer, 4 colonnes) - journal des tentatives :
 *   Colonne A : Date/Heure
 *   Colonne B : Email
 *   Colonne C : Ecole
 *   Colonne D : Résultat (Réussi / Échoué)
 */

function doGet(e) {
  var email = normaliser(e.parameter.email);
  var code = normaliser(e.parameter.code).toUpperCase();
  var ecole = normaliser(e.parameter.ecole);

  var valide = false;

  if (email && code && ecole) {
    var feuilleClients = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Clients");
    var lignes = feuilleClients.getDataRange().getValues();

    for (var i = 1; i < lignes.length; i++) {
      var ligneEmail = normaliser(lignes[i][0]);
      var ligneCode = normaliser(lignes[i][1]).toUpperCase();
      var ligneEcole = normaliser(lignes[i][2]);

      if (ligneEmail === email && ligneCode === code && ligneEcole === ecole) {
        valide = true;
        break;
      }
    }
  }

  enregistrerConnexion(e.parameter.email, e.parameter.ecole, valide);

  return ContentService
    .createTextOutput(JSON.stringify({ valide: valide }))
    .setMimeType(ContentService.MimeType.JSON);
}

function enregistrerConnexion(email, ecole, valide) {
  try {
    var feuille = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Connexions");
    if (!feuille) return; // si l'onglet n'existe pas encore, on ignore silencieusement
    feuille.appendRow([
      new Date(),
      email || "",
      ecole || "",
      valide ? "Réussi" : "Échoué"
    ]);
  } catch (erreur) {
    // on ne bloque jamais l'activation à cause d'un souci de journalisation
  }
}

function normaliser(valeur) {
  return String(valeur || "").trim().toLowerCase();
}
