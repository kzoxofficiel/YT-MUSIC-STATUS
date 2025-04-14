let currentSong = '';
let currentArtist = '';
let currentTime = '';
let currentImageUrl = '';
let currentPageUrl = '';

function extractMusicInfo() {
  currentPageUrl = window.location.href;
  
  const titleElement = document.querySelector('yt-formatted-string.title.style-scope.ytmusic-player-bar');
  if (titleElement) {
    currentSong = titleElement.getAttribute('title') || titleElement.textContent.trim();
    console.log(`Titre trouvé: "${currentSong}"`);
  } else {
    console.log("Aucun élément titre trouvé");
  }
  
  const artistElement = document.querySelector('a.yt-simple-endpoint.style-scope.yt-formatted-string[href^="/channel/"]');
  if (artistElement) {
    currentArtist = artistElement.textContent.trim();
    console.log(`Artiste trouvé: "${currentArtist}"`);
  } else {
    const altArtistElement = document.querySelector('.byline.style-scope.ytmusic-player-bar');
    if (altArtistElement) {
      currentArtist = altArtistElement.textContent.trim();
      console.log(`Artiste trouvé (alt): "${currentArtist}"`);
    } else {
      console.log("Aucun élément artiste trouvé");
    }
  }
  
  const timeElement = document.querySelector('span.time-info.style-scope.ytmusic-player-bar[dir="ltr"][translate="no"]');
  if (timeElement) {
    currentTime = timeElement.textContent.trim();
    console.log(`Temps trouvé: "${currentTime}"`);
  } else {
    console.log("Aucun élément temps trouvé");
  }
  
  const imageElement = document.querySelector('.thumbnail-image-wrapper.style-scope.ytmusic-player-bar img.image.style-scope.ytmusic-player-bar');
  if (imageElement && imageElement.src) {
    currentImageUrl = imageElement.src.replace('w60-h60', 'w512-h512');
    console.log(`Image trouvée: "${currentImageUrl}"`);
  } else {
    console.log("Aucun élément image trouvé");
  }
  
  if (currentSong || currentArtist) {
    console.log("Envoi des informations au script background");
    chrome.runtime.sendMessage({
      action: 'updateSong',
      song: currentSong || "Titre inconnu",
      artist: currentArtist || "Artiste inconnu",
      time: currentTime || "",
      imageUrl: currentImageUrl || "",
      pageUrl: currentPageUrl
    }, response => {
      if (chrome.runtime.lastError) {
        console.error("Erreur lors de l'envoi du message:", chrome.runtime.lastError);
      } else {
        console.log("Message envoyé avec succès");
      }
    });
  }
}

let observer;

function setupObserver() {
  const playerBar = document.querySelector('ytmusic-player-bar');
  if (playerBar) {
    console.log("Lecteur YouTube Music trouvé");
    
    if (observer) {
      observer.disconnect();
    }
    
    observer = new MutationObserver(() => {
      console.log("Changement détecté dans le lecteur");
      extractMusicInfo();
    });
    
    observer.observe(playerBar, { 
      childList: true, 
      subtree: true,
      attributes: true,
      characterData: true
    });
    
    extractMusicInfo();
  } else {
    console.log("Lecteur YouTube Music non trouvé, nouvelle tentative dans 1 seconde");
    setTimeout(setupObserver, 1000);
  }
}

function initialize() {
  console.log("Script content.js initialisé pour YouTube Music");
  setupObserver();
  
  setInterval(extractMusicInfo, 5000);
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "ping") {
    sendResponse({
      status: "active",
      currentSong,
      currentArtist,
      currentTime,
      currentImageUrl,
      currentPageUrl,
      timestamp: Date.now()
    });
    return true;
  } else if (message.action === "forceUpdate") {
    extractMusicInfo();
    sendResponse({success: true});
    return true;
  }
});

if (document.readyState === 'complete') {
  initialize();
} else {
  window.addEventListener('load', initialize);
}