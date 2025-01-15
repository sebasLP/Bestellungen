const express = require("express");
const XLSX = require("xlsx");
const path = require("path");
const fs = require("fs");
const { exec } = require("child_process");
const schedule = require("node-schedule");

const app = express();

// Absoluter Pfad zur Bestellungen-Excel-Datei
const excelFilePath = "C:\\Users\\Eduard-Sebastian\\OneDrive - LAO Ingenieurgesellschaft mbH\\PowerAutomate\\Bestellung.xlsx";

// Neuer Dateipfad für die Koordinatenverarbeitung
const coordinateExcelFilePath = "C:\\Users\\Eduard-Sebastian\\OneDrive - LAO Ingenieurgesellschaft mbH\\PowerAutomate\\Coordinaten.xlsx";

const outputCSVPath = path.join(__dirname, "public", "extrahierte_koordinaten.csv");

// Cache für die Gesamtanzahl der Bestellungen
let cachedOrders = null;

// Funktion: Aktualisiere die Excel-Daten und speichere sie im Cache
async function updateOrdersCache() {
    try {
        if (!fs.existsSync(excelFilePath)) {
            console.error("Excel-Datei nicht gefunden:", excelFilePath);
            cachedOrders = { error: "Excel-Datei nicht gefunden" };
            return;
        }

        // Lese die Excel-Datei und aktualisiere den Cache
        const workbook = XLSX.readFile(excelFilePath);
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const data = XLSX.utils.sheet_to_json(sheet);

        cachedOrders = data.reduce((sum, row) => sum + (row["Gesamtanzahl"] || 0), 0);
        console.log("Cache aktualisiert. Gesamtanzahl der Bestellungen:", cachedOrders);
    } catch (error) {
        console.error("Fehler beim Aktualisieren des Caches:", error);
        cachedOrders = { error: "Fehler beim Aktualisieren des Caches" };
    }
}

// Initialer Cache-Aktualisierungsaufruf
updateOrdersCache();

// Aktualisiere den Cache alle 30 Sekunden im Hintergrund
setInterval(updateOrdersCache, 30000);

// Route, um die Gesamtanzahl der Bestellungen abzurufen
app.get("/orders", (req, res) => {
    try {
        if (cachedOrders === null) {
            return res.status(503).json({ error: "Daten werden noch geladen, bitte versuchen Sie es später erneut." });
        }

        if (cachedOrders.error) {
            return res.status(500).json({ error: cachedOrders.error });
        }

        res.json({ totalOrders: cachedOrders });
    } catch (error) {
        console.error("Fehler beim Abrufen der Bestellungen:", error);
        res.status(500).json({ error: "Fehler beim Abrufen der Bestellungen" });
    }
});

// Funktion zum Zurücksetzen der Bestellungen
function resetOrders() {
    try {
        if (fs.existsSync(excelFilePath)) {
            fs.unlinkSync(excelFilePath);
            console.log("Alte Excel-Datei wurde gelöscht.");
        }

        const data = [
            { ID: 1, Produkt: "Produkt A", Gesamtanzahl: 0 },
            { ID: 2, Produkt: "Produkt B", Gesamtanzahl: 0 },
            { ID: 3, Produkt: "Produkt C", Gesamtanzahl: 0 },
        ];

        const workbook = XLSX.utils.book_new();
        const sheet = XLSX.utils.json_to_sheet(data);
        XLSX.utils.book_append_sheet(workbook, sheet, "Bestellungen");
        XLSX.writeFile(workbook, excelFilePath);

        console.log("Neue Excel-Datei wurde erstellt.");
    } catch (error) {
        console.error("Fehler beim Zurücksetzen der Bestellungen:", error);
    }
}

// **Neue Funktion**: Route, um das Python-Skript zur Koordinatenverarbeitung aufzurufen
app.get("/process-coordinates", (req, res) => {
    const pythonScript = path.join(__dirname, "process_coordinates.py");

    exec(`python ${pythonScript} ${coordinateExcelFilePath} ${outputCSVPath}`, (error, stdout, stderr) => {
        if (error) {
            console.error(`Fehler beim Ausführen des Python-Skripts: ${error.message}`);
            return res.status(500).json({ error: "Fehler beim Ausführen des Python-Skripts" });
        }
        if (stderr) {
            console.error(`Python-Skript Fehlerausgabe: ${stderr}`);
            return res.status(500).json({ error: stderr });
        }
        console.log(`Python-Skript Ausgabe: ${stdout}`);
        res.json({ message: "Koordinaten erfolgreich verarbeitet und gespeichert." });
    });
});

// **Neue Funktion**: Statische Dateien bereitstellen, einschließlich der extrahierten CSV-Datei
app.use("/data", express.static(path.join(__dirname, "public")));

// **Neue Funktion**: Zeitgesteuerter Job für die tägliche Verarbeitung der Koordinaten
schedule.scheduleJob("0 0 * * *", () => {
    const pythonScript = path.join(__dirname, "process_coordinates.py");

    exec(`python ${pythonScript} ${coordinateExcelFilePath} ${outputCSVPath}`, (error, stdout, stderr) => {
        if (error) {
            console.error("Fehler beim täglichen Verarbeiten der Koordinaten:", error.message);
        } else {
            console.log("Koordinaten erfolgreich verarbeitet.");
        }
    });
});

// Zeitgesteuerter Job: Täglich um Mitternacht
schedule.scheduleJob("0 0 * * *", resetOrders);

// Statische Dateien bereitstellen (z. B. für HTML und CSS)
app.use(express.static(path.join(__dirname, "public")));

// Server starten
const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Server läuft auf http://localhost:${PORT}`);
});
