import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/privacy')({
  component: PrivacyPolicy,
});

function PrivacyPolicy() {
  return (
    <main className="min-h-screen bg-gray-50 px-4 py-12 text-gray-900 dark:bg-gray-900 dark:text-gray-100 sm:px-6 lg:px-8">
      <article className="mx-auto max-w-3xl rounded-2xl bg-white p-8 shadow-sm dark:bg-gray-800 sm:p-12">
        <p className="mb-3 text-sm font-semibold uppercase tracking-wide text-sky-700 dark:text-sky-300">
          Dashboard Parapente
        </p>
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
          Politique de confidentialité
        </h1>
        <p className="mt-3 text-sm text-gray-600 dark:text-gray-400">
          Dernière mise à jour : 11 septembre 2026
        </p>

        <div className="prose prose-gray mt-8 max-w-none dark:prose-invert">
          <h2>1. Données traitées</h2>
          <p>
            Dashboard Parapente traite les informations nécessaires au suivi des
            vols, notamment les données de compte, les informations de vol, les
            fichiers GPS et les vidéos importées ou générées par
            l&apos;utilisateur.
          </p>

          <h2>2. Intégration YouTube</h2>
          <p>
            Si vous connectez YouTube, l&apos;application utilise
            l&apos;autorisation Google pour téléverser et, à votre demande,
            supprimer les vidéos associées à vos vols. L&apos;application ne
            demande pas votre mot de passe Google et n&apos;utilise pas les
            données YouTube à d&apos;autres fins.
          </p>
          <p>
            Vous pouvez retirer cette autorisation depuis les paramètres de
            votre compte Google. Vous pouvez également déconnecter YouTube
            depuis Dashboard Parapente.
          </p>

          <h2>3. Utilisation et conservation</h2>
          <p>
            Les données sont utilisées uniquement pour fournir les fonctions de
            Dashboard Parapente. Elles sont conservées tant que votre compte ou
            les données correspondantes restent actifs, puis peuvent être
            supprimées sur demande.
          </p>

          <h2>4. Partage des données</h2>
          <p>
            Les données ne sont pas vendues. Elles peuvent être transmises à un
            service tiers uniquement lorsque vous activez explicitement une
            fonction qui le nécessite, comme le téléversement d&apos;une vidéo
            vers YouTube.
          </p>

          <h2>5. Contact</h2>
          <p>
            Pour toute question ou demande relative à vos données, contactez
            <a href="mailto:vcapic@gmail.com"> vcapic@gmail.com</a>.
          </p>
        </div>
      </article>
    </main>
  );
}
