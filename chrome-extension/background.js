let localAppPort = 8765; 
let discordRPCEnabled = true;

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'updateSong') {
    console.log(`Musique en cours : ${message.song} - ${message.artist} (${message.time})`);
    console.log(`Image : ${message.imageUrl}`);
    console.log(`URL de la page : ${message.pageUrl}`);
    
    if (discordRPCEnabled) {
      sendToLocalApp({
        type: 'music_update',
        song: message.song,
        artist: message.artist,
        time: message.time,
        imageUrl: message.imageUrl,
        pageUrl: message.pageUrl,
        timestamp: Date.now()
      });
    }
  } else if (message.action === 'updateSettings') {
    discordRPCEnabled = message.discordRPCEnabled;
    localAppPort = message.localAppPort;
    
    chrome.storage.sync.set({
      discordRPCEnabled: discordRPCEnabled,
      localAppPort: localAppPort
    });
  } else if (message.action === 'getSettings') {
    sendResponse({
      discordRPCEnabled: discordRPCEnabled,
      localAppPort: localAppPort
    });
    return true; 
  } else if (message.action === 'testConnection') {
    testLocalAppConnection()
      .then(result => {
        sendResponse({ success: result.success, message: result.message, data: result.data });
      })
      .catch(error => {
        sendResponse({ success: false, message: error.message });
      });
    return true; 
  } else if (message.action === 'contentScriptActive') {
    console.log(`Script de contenu actif sur ${message.url}`);
  }
});

function testLocalAppConnection() {
  return fetch(`http://localhost:${localAppPort}/status`, {
    method: 'GET'
  })
  .then(response => {
    if (response.ok) {
      return response.json().then(data => {
        return { success: true, message: 'Connecté', data: data };
      });
    } else {
      return { success: false, message: 'Serveur inaccessible' };
    }
  })
  .catch(error => {
    return { success: false, message: `Erreur: ${error.message}` };
  });
}

function sendToLocalApp(data) {
  fetch(`http://localhost:${localAppPort}/update`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(data)
  })
  .then(response => {
    if (!response.ok) {
      console.error('Erreur lors de l\'envoi des données à l\'application locale');
    }
    return response.json();
  })
  .then(data => {
    console.log('Réponse du serveur local:', data);
  })
  .catch(error => {
    console.error('Erreur de connexion à l\'application locale:', error);
  });
}

chrome.storage.sync.get(['discordRPCEnabled', 'localAppPort'], (result) => {
  if (result.discordRPCEnabled !== undefined) {
    discordRPCEnabled = result.discordRPCEnabled;
  }
  if (result.localAppPort !== undefined) {
    localAppPort = result.localAppPort;
  }
});

console.log('Script background.js chargé');