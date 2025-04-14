// app.js - Application Node.js pour Discord RPC avec bouton de redirection
const express = require('express');
const cors = require('cors');
const DiscordRPC = require('discord-rpc');
const app = express();
const port = 8765;

// Configuration de Discord RPC
const clientId = '1361265715872792631'; // À remplacer par votre ID client Discord Developer
const rpc = new DiscordRPC.Client({ transport: 'ipc' });

// Variables pour stocker l'état actuel
let currentSong = '';
let currentArtist = '';
let currentTime = '';
let currentImageUrl = '';
let currentPageUrl = '';
let startTimestamp = Date.now();
let lastSongId = ''; // Pour détecter le changement de chanson
let updateQueue = []; // File d'attente pour les mises à jour
let isUpdating = false; // Indicateur de mise à jour en cours

// Middleware
app.use(cors());
app.use(express.json());

// Endpoint pour recevoir les mises à jour de l'extension Chrome
app.post('/update', (req, res) => {
  const { song, artist, time, imageUrl, pageUrl } = req.body;
  
  console.log(`Mise à jour reçue: ${song} - ${artist} (${time})`);
  console.log(`Image: ${imageUrl}`);
  console.log(`URL de la page: ${pageUrl}`);
  
  // Créer un identifiant unique pour la chanson
  const songId = `${song}-${artist}`;
  
  // Si la chanson a changé, mettre à jour le timestamp de départ et donner priorité élevée
  const priority = songId !== lastSongId ? 'high' : 'normal';
  
  if (songId !== lastSongId) {
    console.log("Nouvelle chanson détectée, réinitialisation du timestamp");
    startTimestamp = Date.now();
    lastSongId = songId;
    
    // Forcer un rafraîchissement immédiat du statut pour une nouvelle chanson
    currentSong = song;
    currentArtist = artist;
    currentTime = time;
    currentImageUrl = imageUrl;
    currentPageUrl = pageUrl || '';
    
    // Priorité élevée: vider la file d'attente et mettre à jour immédiatement
    updateQueue = [];
    updateDiscordStatus(true);
  } else {
    // Ajouter à la file d'attente pour les mises à jour régulières
    updateQueue.push({
      song,
      artist,
      time,
      imageUrl,
      pageUrl: pageUrl || '',
      priority
    });
    
    // Déclencher le traitement de la file d'attente
    processUpdateQueue();
  }
  
  res.status(200).json({ 
    success: true,
    message: "Mise à jour traitée avec succès",
    data: {
      song,
      artist,
      time,
      pageUrl,
      startTimestamp,
      priority
    }
  });
});

// Fonction pour traiter la file d'attente des mises à jour
function processUpdateQueue() {
  if (isUpdating || updateQueue.length === 0) return;
  
  isUpdating = true;
  
  // Trier la file d'attente par priorité (high en premier)
  updateQueue.sort((a, b) => {
    if (a.priority === 'high' && b.priority !== 'high') return -1;
    if (a.priority !== 'high' && b.priority === 'high') return 1;
    return 0;
  });
  
  // Prendre la prochaine mise à jour
  const update = updateQueue.shift();
  
  // Mettre à jour les variables d'état
  currentSong = update.song;
  currentArtist = update.artist;
  currentTime = update.time;
  currentImageUrl = update.imageUrl;
  currentPageUrl = update.pageUrl;
  
  // Appliquer la mise à jour à Discord
  updateDiscordStatus().then(() => {
    isUpdating = false;
    
    // Petit délai avant la prochaine mise à jour pour éviter le rate limit de Discord
    setTimeout(() => {
      processUpdateQueue();
    }, 100);
  }).catch(error => {
    console.error('Erreur lors de la mise à jour:', error);
    isUpdating = false;
    
    // Réessayer après un délai plus long en cas d'erreur
    setTimeout(() => {
      processUpdateQueue();
    }, 1000);
  });
}

// Endpoint pour vérifier le statut
app.get('/status', (req, res) => {
  const isConnected = rpc && rpc.transport && rpc.transport.socket !== null;
  
  res.status(200).json({
    connected: isConnected,
    currentSong,
    currentArtist,
    currentTime,
    currentImageUrl,
    currentPageUrl,
    startTimestamp,
    queueLength: updateQueue.length,
    isUpdating
  });
});

// Fonction pour extraire la miniature YouTube en haute résolution
function getHighResImage(url) {
  // Si nous avons une URL d'image de YouTube, essayons d'obtenir une version plus grande
  if (url && url.includes('googleusercontent.com')) {
    // Remplacer les paramètres de taille pour obtenir une image plus grande
    return url.replace('w60-h60', 'w512-h512');
  }
  return url;
}

// Fonction pour extraire les temps de début et fin
function parseTimeInfo(timeInfo) {
  if (!timeInfo) return {};
  
  const times = timeInfo.match(/(\d+:\d+)\s*\/\s*(\d+:\d+)/);
  if (times && times.length >= 3) {
    const currentTime = times[1];
    const totalTime = times[2];
    
    // Convertir les temps en secondes
    const convertToSeconds = (timeStr) => {
      const [minutes, seconds] = timeStr.split(':').map(Number);
      return minutes * 60 + seconds;
    };
    
    const currentSeconds = convertToSeconds(currentTime);
    const totalSeconds = convertToSeconds(totalTime);
    
    return {
      current: currentTime,
      total: totalTime,
      currentSeconds,
      totalSeconds
    };
  }
  
  return {};
}

// Fonction pour s'assurer que les chaînes respectent les exigences de longueur de Discord
// en ajoutant un caractère invisible si nécessaire
function addInvisibleCharIfNeeded(str) {
  if (!str) return "Sans titre";
  
  // Si la chaîne a moins de 2 caractères, ajouter un caractère invisible (U+200B)
  if (str.length < 2) {
    console.log(`Titre court détecté: "${str}", ajout d'un caractère invisible`);
    return str + "\u200B"; // Ajoute un caractère de largeur zéro (Zero Width Space)
  }
  
  return str;
}

// Fonction pour mettre à jour le statut Discord
function updateDiscordStatus(force = false) {
  return new Promise((resolve, reject) => {
    if (!rpc || !rpc.transport || rpc.transport.socket === null) {
      console.log("Discord RPC non connecté, impossible de mettre à jour le statut");
      return reject(new Error("Discord RPC non connecté"));
    }
    
    try {
      // Assurer que le titre a au moins 2 caractères en ajoutant un caractère invisible si nécessaire
      const songTitle = addInvisibleCharIfNeeded(currentSong);
      
      // Préparer le message de l'artiste
      const artistInfo = currentArtist ? `par ${currentArtist}` : "Artiste inconnu";
      
      const activity = {
        details: songTitle,
        state: artistInfo,
        largeImageKey: currentImageUrl || 'music_icon',
        largeImageText: songTitle,
        smallImageKey: 'play_icon',
        smallImageText: currentTime || 'En lecture',
        instance: false,
      };
      
      // Gérer l'affichage du temps écoulé de la chanson
      if (currentTime) {
        const timeInfo = parseTimeInfo(currentTime);
        if (timeInfo.currentSeconds !== undefined && timeInfo.totalSeconds !== undefined) {
          // Utiliser le timestamp de départ pour montrer le temps écoulé depuis le début de la chanson
          activity.startTimestamp = startTimestamp;
        }
      } else {
        // Si pas d'info de temps, utiliser simplement le timestamp de départ
        activity.startTimestamp = startTimestamp;
      }
      
      // Ajouter un bouton pour écouter la musique si nous avons une URL
      if (currentPageUrl) {
        activity.buttons = [
          {
            label: "Écouter sur YouTube Music",
            url: currentPageUrl
          }
        ];
      }
      
      console.log(`Mise à jour du statut Discord ${force ? "(prioritaire)" : ""}:`, activity);
      
      rpc.setActivity(activity).then(() => {
        console.log("Statut Discord mis à jour avec succès");
        resolve();
      }).catch(error => {
        console.error('Erreur lors de la mise à jour du statut Discord:', error);
        
        // En cas d'erreur, essayer avec des valeurs encore plus sûres
        if (error && error.code === 4000) {
          console.log("Tentative avec des valeurs par défaut...");
          
          const fallbackActivity = {
            details: "En écoute",
            state: (currentSong || "Sans titre") + " - " + (currentArtist || "Artiste inconnu"),
            largeImageKey: currentImageUrl || 'music_icon',
            largeImageText: "YouTube Music",
            startTimestamp: startTimestamp,
            instance: false
          };
          
          // Ajouter un bouton pour écouter la musique si nous avons une URL
          if (currentPageUrl) {
            fallbackActivity.buttons = [
              {
                label: "Écouter sur YouTube Music",
                url: currentPageUrl
              }
            ];
          }
          
          console.log("Tentative avec activité de secours:", fallbackActivity);
          
          rpc.setActivity(fallbackActivity).then(() => {
            console.log("Statut Discord mis à jour avec succès (valeurs de secours)");
            resolve();
          }).catch(secondError => {
            console.error('Échec de la seconde tentative:', secondError);
            reject(secondError);
          });
        } else {
          reject(error);
        }
      });
    } catch (error) {
      console.error('Erreur lors de la préparation du statut Discord:', error);
      reject(error);
    }
  });
}

// Connexion à Discord
rpc.on('ready', () => {
  console.log('Discord RPC connecté!');
  
  // Mettre à jour le statut initial si des informations sont disponibles
  if (currentSong && currentArtist) {
    updateDiscordStatus(true);
  }
});

// Gestion explicite des erreurs pour éviter les crashs
process.on('unhandledRejection', (reason, promise) => {
  console.error('Promesse non gérée rejetée:', reason);
  // Ne pas laisser le processus s'arrêter
});

// Se connecter à Discord avec l'ID client
function connectToDiscord() {
  console.log("Tentative de connexion à Discord RPC...");
  
  rpc.login({ clientId }).catch(error => {
    console.error('Erreur de connexion à Discord:', error);
    console.log("Nouvelle tentative dans 15 secondes");
    // Tentative de reconnexion après 15 secondes
    setTimeout(connectToDiscord, 15000);
  });
}

// Reconnexion automatique en cas de déconnexion
rpc.on('disconnected', () => {
  console.log('Discord RPC déconnecté! Tentative de reconnexion...');
  setTimeout(connectToDiscord, 10000);
});

// Gestionnaire d'erreurs pour l'application Express
app.use((err, req, res, next) => {
  console.error('Erreur dans l\'application Express:', err);
  res.status(500).json({
    success: false,
    message: 'Erreur serveur',
    error: err.message
  });
});

// Démarrer le serveur
app.listen(port, () => {
  console.log(`Serveur en écoute sur http://localhost:${port}`);
  connectToDiscord();
});

// Gérer la fermeture propre de l'application
process.on('SIGINT', () => {
  console.log('Fermeture de l\'application...');
  if (rpc && rpc.transport) {
    rpc.destroy().catch(console.error);
  }
  process.exit(0);
});