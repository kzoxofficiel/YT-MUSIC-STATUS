document.addEventListener('DOMContentLoaded', function() {
    const discordRPCEnabledCheckbox = document.getElementById('discord-rpc-enabled');
    const localAppPortInput = document.getElementById('local-app-port');
    const saveButton = document.getElementById('save-settings');
    const connectionStatus = document.getElementById('connection-status');
    const currentSongElement = document.getElementById('current-song');
    
    const popupContent = document.querySelector('body');
    const debugDiv = document.createElement('div');
    debugDiv.className = 'debug-info';
    debugDiv.innerHTML = `
      <hr>
      <div class="title">Informations de débogage</div>
      <div>
        <button id="refresh-status">Rafraîchir le statut</button>
        <button id="check-content-script">Vérifier le script</button>
      </div>
      <div class="status-details" style="margin-top: 10px; font-size: 12px;">
        <pre id="status-json">Aucune information disponible</pre>
      </div>
    `;
    popupContent.appendChild(debugDiv);
    
    const refreshStatusButton = document.getElementById('refresh-status');
    const checkContentScriptButton = document.getElementById('check-content-script');
    const statusJsonElement = document.getElementById('status-json');
    
    chrome.runtime.sendMessage({ action: 'getSettings' }, function(response) {
      if (response) {
        discordRPCEnabledCheckbox.checked = response.discordRPCEnabled;
        localAppPortInput.value = response.localAppPort;
      }
    });
    
    function checkConnection() {
      refreshStatusButton.disabled = true;
      refreshStatusButton.textContent = "Rafraîchissement...";
      
      chrome.runtime.sendMessage({ 
        action: 'testConnection',
        port: parseInt(localAppPortInput.value, 10)
      }, function(response) {
        refreshStatusButton.disabled = false;
        refreshStatusButton.textContent = "Rafraîchir le statut";
        
        if (response && response.success) {
          connectionStatus.textContent = 'Connecté';
          connectionStatus.style.color = 'green';
          
          if (response.data && response.data.currentSong) {
            currentSongElement.textContent = `${response.data.currentSong} - ${response.data.currentArtist}`;
          }
          
          statusJsonElement.textContent = JSON.stringify(response, null, 2);
        } else {
          connectionStatus.textContent = 'Non connecté';
          connectionStatus.style.color = 'red';
          statusJsonElement.textContent = JSON.stringify(response, null, 2);
        }
      });
    }
    
    function checkContentScript() {
      checkContentScriptButton.disabled = true;
      checkContentScriptButton.textContent = "Vérification...";
      
      chrome.tabs.query({url: "*://music.youtube.com/*"}, function(tabs) {
        if (tabs.length === 0) {
          statusJsonElement.textContent = "Aucun onglet YouTube Music trouvé";
          checkContentScriptButton.disabled = false;
          checkContentScriptButton.textContent = "Vérifier le script";
          return;
        }
        
        chrome.tabs.sendMessage(tabs[0].id, {action: "ping"}, function(response) {
          if (chrome.runtime.lastError) {
            statusJsonElement.textContent = `Erreur: ${chrome.runtime.lastError.message}\n\nLe script de contenu ne semble pas être chargé. Essayez de rafraîchir l'onglet YouTube Music.`;
          } else if (response) {
            statusJsonElement.textContent = `Script de contenu actif!\nRéponse: ${JSON.stringify(response)}`;
          } else {
            statusJsonElement.textContent = "Le script de contenu ne répond pas. Essayez de rafraîchir l'onglet YouTube Music.";
          }
          
          checkContentScriptButton.disabled = false;
          checkContentScriptButton.textContent = "Vérifier le script";
        });
      });
    }
    
    saveButton.addEventListener('click', function() {
      const settings = {
        action: 'updateSettings',
        discordRPCEnabled: discordRPCEnabledCheckbox.checked,
        localAppPort: parseInt(localAppPortInput.value, 10)
      };
      
      chrome.runtime.sendMessage(settings, function() {
        alert('Paramètres enregistrés!');
        checkConnection();
      });
    });
    
    refreshStatusButton.addEventListener('click', checkConnection);
    checkContentScriptButton.addEventListener('click', checkContentScript);
    
    checkConnection();
    
    const style = document.createElement('style');
    style.textContent = `
      .debug-info {
        margin-top: 15px;
        padding-top: 10px;
        border-top: 1px solid #ccc;
      }
      #status-json {
        background-color: #f5f5f5;
        padding: 5px;
        border: 1px solid #ddd;
        max-height: 200px;
        overflow-y: auto;
        font-family: monospace;
        white-space: pre-wrap;
        font-size: 11px;
      }
    `;
    document.head.appendChild(style);
  });