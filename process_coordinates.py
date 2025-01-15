import re
import pandas as pd
import time
import os
from threading import Thread

# Funktion zur Extraktion des Koordinatenbereichs nach POLYGON
def extract_polygon_coordinates(text):
    if isinstance(text, str):
        match = re.search(r'POLYGON\s*\(\((.*?)\)\)', text, re.DOTALL)
        if match:
            return match.group(1)  # Extrahiere nur die Koordinaten
    return None

# Funktion zur Verarbeitung der Koordinaten
def process_coordinates(file_path, output_path):
    try:
        # Prüfen, ob die alte Datei existiert, und sie löschen
        if os.path.exists(output_path):
            os.remove(output_path)
            print(f"Alte Datei '{output_path}' wurde gelöscht.")

        # Excel-Datei einlesen
        data = pd.read_excel(file_path)

        # Annahme: Die relevante Spalte heißt 'Inhalt der E-Mail'
        if 'Inhalt der E-Mail' in data.columns:
            # Extrahieren des Koordinatenbereichs
            data['Koordinaten'] = data['Inhalt der E-Mail'].apply(extract_polygon_coordinates)

            # Nur Zeilen mit extrahierten Koordinaten anzeigen
            extracted_data = data[['Koordinaten']].dropna()

            # Entferne Anführungszeichen und Zeilenumbrüche, falls vorhanden
            extracted_data['Koordinaten'] = extracted_data['Koordinaten'].str.replace('"', '', regex=False).str.replace('\n', ' ', regex=False)

            # Jede Koordinate in eine eigene Spalte aufteilen
            split_coordinates = extracted_data['Koordinaten'].str.split(', ', expand=True)

            # Entferne eventuell zusätzliche Leerzeichen
            split_coordinates = split_coordinates.applymap(lambda x: x.strip() if isinstance(x, str) else x)

            # Ergebnisse speichern
            split_coordinates.to_csv(output_path, index=False, header=False)  # Keine Headerzeile speichern
            print(f"Die Koordinaten wurden erfolgreich in die Datei '{output_path}' gespeichert.")
        else:
            print("Die Spalte 'Inhalt der E-Mail' wurde nicht gefunden.")
    except Exception as e:
        print(f"Fehler beim Verarbeiten der Datei: {e}")

# Hintergrundprozess für die kontinuierliche Verarbeitung
def continuous_processing(file_path, output_path, interval=30):
    while True:
        process_coordinates(file_path, output_path)
        print(f"Warte {interval} Sekunden bis zur nächsten Aktualisierung...")
        time.sleep(interval)

if __name__ == "__main__":
    # Pfade zur Eingabe- und Ausgabedatei
    file_path = r"C:\Users\Eduard-Sebastian\OneDrive - LAO Ingenieurgesellschaft mbH\PowerAutomate\Coordinaten.xlsx"
    output_path = os.path.join("public", "extrahierte_koordinaten.csv")  # Speichern im Ordner 'public'

    # Hintergrundthread starten
    thread = Thread(target=continuous_processing, args=(file_path, output_path), daemon=True)
    thread.start()

    # Halten Sie die Hauptanwendung am Laufen
    try:
        while True:
            print("Der Hintergrundprozess läuft...")
            time.sleep(60)  # Warten Sie, um den Hauptprozess aktiv zu halten
    except KeyboardInterrupt:
        print("Hintergrundprozess wurde beendet.")
