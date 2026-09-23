/**
 * L'affiche du salon : un bouton pour lancer l'impression.
 *
 * La politique de securite du contenu interdit tout gestionnaire en ligne
 * (« onclick ») : c'est ce fichier qui branche le bouton.
 */
const bouton = document.querySelector('[data-imprimer]');
if (bouton) bouton.addEventListener('click', () => window.print());
