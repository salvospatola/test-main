# EFG NSU Portal

Dieses Portal dient der Verwaltung des Dienstplans und der Kommunikation für die EFG NSU.

## 🚀 Produktion Setup & CI/CD

### Voraussetzungen
- Docker & Docker Compose auf der VM.
- Ein dediziertes WhatsApp-Gerät für den Bot.

### Umgebungsvariablen (.env)
Erstelle eine `.env` Datei auf deiner VM (oder lokal) basierend auf `.env.example`:

```env
PORT=3000
MONGODB_URI=mongodb://mongodb:27017/efg-nsu-portal # Interner Docker-Hostname
JWT_SECRET=dein-super-geheimnisvoller-schlüssel
BASE_URL=https://deine-domain.de
NODE_ENV=production
```

## 🔄 Deployment & Pipeline

Das Projekt nutzt **GitHub Actions** für automatisiertes Deployment.

### Automatisierter Flow
Bei jedem Push auf `main`:
1. GitHub verbindet sich via SSH mit der VM.
2. Code wird nach `/var/www/efg-portal` gepullt.
3. Docker Container werden neu gebaut und gestartet.
4. Startup-Logs werden zur Verifikation in GitHub ausgegeben.

### Secrets in GitHub
Hinterlege diese Secrets unter *Settings > Actions*:
- `VM_HOST`: IP deiner VM
- `VM_USER`: SSH Benutzername
- `SSH_PRIVATE_KEY`: Dein privater SSH-Key

## 🌱 Sensible Daten & Seeding

Nutzerdaten und Pläne befinden sich nicht im Git-Repository.
Um Initialdaten einzuspielen:

1. Bearbeite die Datei `seed_sensitive.js` lokal (wird via `.gitignore` ignoriert).
2. Stelle sicher, dass die `.env` auf die Ziel-DB zeigt.
3. Führe den Import aus:
   ```bash
   node seed_sensitive.js
   ```

## 🛠 Features
- **OTP Registrierung**: Anmeldung via Handy-Nummer + WhatsApp-Code (1 Jahr gültig).
- **Rollen-Management**: Nutzer starten als `USER`, Admin befördert zu `MEMBER`.
- **Dienstplaner**: Interaktive Verwaltung von Terminen.
- **WhatsApp Bot**: Automatische Umfragen und Erinnerungen.

## 🔒 Sicherheit
- **NoSQL Injection Schutz**: Alle Auth-Inputs werden gestrippt/gecastet.
- **Sichere Sessions**: HttpOnly Cookies & JWT.
- **Zero-Secret Policy**: Keine Passwörter oder Keys im Source-Code.