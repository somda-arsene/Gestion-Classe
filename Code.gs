/**
 * Script de vérification des codes d'activation - Gestion-Classe
 * ------------------------------------------------------------
 * À coller dans Extensions > Apps Script, depuis un Google Sheet
 * qui contient une feuille nommée "Clients" avec 3 colonnes :
 *   Colonne A : Email
 *   Colonne B : Code
 *   Colonne C : Ecole
 *
 * L'application enverra l'email, le code et le nom de l'école
 * saisis par l'utilisateur. Ce script répond juste { "valide": true }
 * ou { "valide": false }, sans jamais révéler comment le code
 * a été créé.
 */

function doGet(e) {
  var email = normaliser(e.parameter.email);
  var code = normaliser(e.parameter.code).toUpperCase();
  var ecole = normaliser(e.parameter.ecole);

  var valide = false;

  if (email && code && ecole) {
    var feuille = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Clients");
    var lignes = feuille.getDataRange().getValues();

    // On saute la ligne d'en-tête (ligne 0)
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

  return ContentService
    .createTextOutput(JSON.stringify({ valide: valide }))
    .setMimeType(ContentService.MimeType.JSON);
}

function normaliser(valeur) {
  return String(valeur || "").trim().toLowerCase();
}
