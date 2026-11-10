"""Lance Parcours lecture en mode studio ou élève dans le navigateur."""

import argparse
import json
import os
import shutil
import subprocess
import sys
import time
import webbrowser
from pathlib import Path
from urllib.error import URLError
from urllib.request import urlopen


RACINE = Path(__file__).resolve().parent


def serveur_pret(adresse):
    """Vérifie qu'un serveur Parcours lecture répond à cette adresse."""
    try:
        with urlopen(f"{adresse}/contenu/parcours.json", timeout=0.5) as reponse:
            contenu = json.load(reponse)
        return isinstance(contenu.get("parcours"), list)
    except (URLError, TimeoutError, ValueError, OSError, AttributeError):
        return False


def main():
    analyseur = argparse.ArgumentParser(description="Ouvre le studio ou le mode élève.")
    analyseur.add_argument("mode", nargs="?", choices=("studio", "eleve"), default="studio")
    analyseur.add_argument("--port", type=int, default=5174, help="Port du serveur local (défaut : 5174)")
    args = analyseur.parse_args()

    if not 1 <= args.port <= 65535:
        analyseur.error("le port doit être compris entre 1 et 65535")

    adresse = f"http://localhost:{args.port}"
    page = f"{adresse}/#/studio" if args.mode == "studio" else f"{adresse}/#/"

    if serveur_pret(adresse):
        print(f"Serveur déjà actif. Ouverture de {page}")
        webbrowser.open(page)
        return 0

    node = shutil.which("node")
    if not node:
        print("Node.js est introuvable. Installez-le ou ajoutez-le au PATH.", file=sys.stderr)
        return 1

    environnement = os.environ.copy()
    if sys.platform == "win32":
        environnement.setdefault("NODE_USE_SYSTEM_CA", "1")

    serveur = subprocess.Popen(
        [node, str(RACINE / "scripts" / "serveur-local.mjs"), "--port", str(args.port)],
        cwd=RACINE,
        env=environnement,
    )
    try:
        limite = time.monotonic() + 10
        while time.monotonic() < limite:
            if serveur.poll() is not None:
                print("Le serveur s'est arrêté. Vérifiez les messages ci-dessus.", file=sys.stderr)
                return 1
            if serveur_pret(adresse):
                print(f"Ouverture de {page}")
                webbrowser.open(page)
                print("Appuyez sur Ctrl+C pour arrêter le serveur.")
                serveur.wait()
                return 0
            time.sleep(0.2)
        print("Le serveur n'a pas répondu à temps. Vérifiez le port et les messages ci-dessus.", file=sys.stderr)
        return 1
    except KeyboardInterrupt:
        print("\nArrêt du serveur…")
        return 0
    finally:
        if serveur.poll() is None:
            serveur.terminate()
            try:
                serveur.wait(timeout=5)
            except subprocess.TimeoutExpired:
                serveur.kill()
                serveur.wait()


if __name__ == "__main__":
    sys.exit(main())
