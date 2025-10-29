const api = 'http://localhost:3000';

const loginBtn = document.getElementById('login-btn');
const loginBtnCard = document.getElementById('login-btn-card');
const logoutBtn = document.getElementById('logout-btn');
const userInfo = document.getElementById('user-info');
const usernameDisplay = document.getElementById('username-display');
const userAvatar = document.getElementById('user-avatar');
const loginRequiredCard = document.getElementById('login-required-card');
const gamesContent = document.getElementById('games-content');

const activeGamesList = document.getElementById('active-games-list');
const recentGamesList = document.getElementById('recent-games-list');
const noGamesMessage = document.getElementById('no-games-message');
const noRecentGames = document.getElementById('no-recent-games');
const gamesLoading = document.getElementById('games-loading');

const totalGamesElement = document.getElementById('total-games');
const totalValueElement = document.getElementById('total-value');
const biggestWinElement = document.getElementById('biggest-win');
const topPlayerElement = document.getElementById('top-player');

const createGameBtn = document.getElementById('create-game-btn');
const createFirstGameBtn = document.getElementById('create-first-game-btn');
const refreshGamesBtn = document.getElementById('refresh-games-btn');

const betSkinSelect = document.getElementById('bet-skin');
let skinPreview = document.getElementById('skin-preview');
let skinImage = document.getElementById('skin-image');
let skinName = document.getElementById('skin-name');
let skinRarity = document.getElementById('skin-rarity');
let skinValue = document.getElementById('skin-value');

const createGameForm = document.getElementById('create-game-form');
const createGameSubmitBtn = document.getElementById('create-game-submit-btn');
const createGameError = document.getElementById('create-game-error');

const creatorUsername = document.getElementById('creator-username');
const creatorAvatar = document.getElementById('creator-avatar');
const creatorSkinsList = document.getElementById('creator-skins-list');
const joinSkinSelect = document.getElementById('join-skin');
const joinSkinPreview = document.getElementById('join-skin-preview');
const joinSkinImage = document.getElementById('join-skin-image');
const joinSkinName = document.getElementById('join-skin-name');
const joinSkinRarity = document.getElementById('join-skin-rarity');
const joinSkinValue = document.getElementById('join-skin-value');

const joinGameForm = document.getElementById('join-game-form');
const joinGameSubmitBtn = document.getElementById('join-game-submit-btn');
const joinGameError = document.getElementById('join-game-error');
const joinValueIndicator = document.getElementById('join-value-indicator');
const addJoinSkinBtn = document.getElementById('add-join-skin-btn');
const joinSelectedSkinsContainer = document.getElementById('join-selected-skins-container');
const joinSelectedSkinsList = document.getElementById('join-selected-skins-list');
const joinSelectedSkinsTotalValue = document.getElementById('join-selected-skins-total-value');

const resultHeader = document.getElementById('result-header');
const resultTitle = document.getElementById('result-title');
const resultCreatorName = document.getElementById('result-creator-name');
const resultCreatorSkins = document.getElementById('result-creator-skins');
const resultCreatorValue = document.getElementById('result-creator-value');
const resultJoinerName = document.getElementById('result-joiner-name');
const resultJoinerSkins = document.getElementById('result-joiner-skins');
const resultJoinerValue = document.getElementById('result-joiner-value');
const winnerInfo = document.getElementById('winner-info');
const creatorRollDisplay = document.getElementById('creator-roll');
const joinerRollDisplay = document.getElementById('joiner-roll');
const creatorDice = document.getElementById('creator-dice');
const joinerDice = document.getElementById('joiner-dice');
const playAgainBtn = document.getElementById('play-again-btn');
const closeResultBtn = document.getElementById('closeResultBtn');

const addSkinBtn = document.getElementById('add-skin-btn');
const selectedSkinsContainer = document.getElementById('selected-skins-container');
const selectedSkinsList = document.getElementById('selected-skins-list');
const selectedSkinsTotalValue = document.getElementById('selected-skins-total-value');

let user = null;
let activeGames = [];
let recentGames = [];
let selectedGameId = null;
let userInventory = [];
let allSkins = [];
let selectedSkins = [];
let joinSelectedSkins = [];

document.addEventListener('DOMContentLoaded', () => {
  window.createGameModal = new BootstrapModal(document.getElementById('createGameModal'));
  window.joinGameModal = new BootstrapModal(document.getElementById('joinGameModal'));
  window.gameResultModal = new BootstrapModal(document.getElementById('gameResultModal'));
  
  document.querySelectorAll('.modal-close, #cancelCreateGame, #cancelJoinGame, #closeResultBtn').forEach(el => {
    el.addEventListener('click', function() {
      const modal = this.closest('.modal-overlay');
      modal.classList.remove('active');
    });
  });
  
  if (createFirstGameBtn) {
    createFirstGameBtn.addEventListener('click', () => {
      openCreateGameModal();
    });
  }
  
  if (refreshGamesBtn) {
    refreshGamesBtn.addEventListener('click', () => {
      fetchActiveGames();
    });
  }
  
  init();
});

function formatValue(value) {
  return value?.toLocaleString() || '0';
}

function formatDate(dateString) {
  return new Date(dateString).toLocaleString();
}

function getRarityColor(rarity) {
  const colors = {
    'common': 'secondary',
    'uncommon': 'success',
    'rare': 'primary',
    'epic': 'purple',
    'legendary': 'warning',
    'mythic': 'danger'
  };
  return colors[rarity?.toLowerCase()] || 'secondary';
}

function showError(element, message) {
  element.textContent = message;
  element.style.display = 'block';
  element.classList.add('shake');
  setTimeout(() => {
    element.classList.remove('shake');
  }, 500);
}

function hideError(element) {
  element.style.display = 'none';
  element.textContent = '';
}

function showLoading(element) {
  element.innerHTML = '<div class="spinner" style="margin-right: 8px;"></div> Loading...';
  element.disabled = true;
}

function hideLoading(element, text) {
  element.innerHTML = text;
  element.disabled = false;
}

function showNotification(title, message, actionText, actionCallback) {
  const notification = document.getElementById('game-notification');
  const notificationTitle = document.getElementById('notification-title');
  const notificationMessage = document.getElementById('notification-message');
  const notificationAction = document.getElementById('notification-action');
  const notificationDismiss = document.getElementById('notification-dismiss');
  
  notificationTitle.textContent = title;
  notificationMessage.textContent = message;
  notificationAction.textContent = actionText || 'View';
  
  notificationAction.onclick = () => {
    if (typeof actionCallback === 'function') {
      actionCallback();
    }
    notification.classList.remove('show');
  };
  
  notificationDismiss.onclick = () => {
    notification.classList.remove('show');
  };
  
  notification.classList.add('show');
  
  setTimeout(() => {
    notification.classList.remove('show');
  }, 15000);
}

async function fetchActiveGames() {
  try {
    gamesLoading.style.display = 'block';
    noGamesMessage.style.display = 'none';
    activeGamesList.innerHTML = '';
    
    const response = await fetch(`${api}/dice/active`);
    if (!response.ok) throw new Error('Failed to fetch active games');
    
    const data = await response.json();
    activeGames = data.games || [];
    
    const skinPromises = activeGames.map(game => fetchAndCacheSkin(Array.isArray(game.betSkins) ? game.betSkins[0] : game.betSkins));
    await Promise.allSettled(skinPromises);
    
    renderActiveGames();
  } catch (error) {
    console.error('Error fetching active games:', error);
    showNoGames('Error loading games. Please try again later.');
  } finally {
    gamesLoading.style.display = 'none';
  }
}

async function fetchRecentGames() {
  try {
    const response = await fetch(`${api}/dice/recent`);
    if (!response.ok) throw new Error('Failed to fetch recent games');
    
    const data = await response.json();
    recentGames = data.games || [];
    
    renderRecentGames();
  } catch (error) {
    console.error('Error fetching recent games:', error);
    noRecentGames.textContent = 'Error loading recent games. Please try again later.';
    noRecentGames.style.display = 'block';
  }
}

async function fetchSkins() {
  try {
    const response = await fetch(`${api}/skins`);
    if (!response.ok) throw new Error('Failed to fetch skins');
    
    const data = await response.json();
    allSkins = data.skins || [];
  } catch (error) {
    console.error('Error fetching skins:', error);
  }
}

async function fetchUserInventory() {
  if (!user) return;
  
  try {
    const token = AuthClient.getToken();
    const response = await fetch(`${api}/inventory?discordId=${user.discordId}`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (!response.ok) {
      if (response.status === 401) {
        AuthClient.logout();
        return;
      }
      throw new Error('Failed to fetch inventory');
    }
    
    const data = await response.json();
    userInventory = data.skins || [];
    
    updateSkinSelects();
  } catch (error) {
    console.error('Error fetching user inventory:', error);
  }
}

async function fetchAndCacheSkin(skinName) {
  if (!skinName) {
    console.warn("Attempted to fetch undefined skin");
    return null;
  }
  
  try {
    const cachedSkin = allSkins.find(skin => skin.name === skinName);
    if (cachedSkin) {
      return cachedSkin;
    }
    
    const response = await fetch(`${api}/skin/${encodeURIComponent(skinName)}`);
    if (!response.ok) {
      console.warn(`Failed to fetch skin "${skinName}": ${response.status}`);
      return null;
    }
    
    const skinData = await response.json();
    allSkins.push(skinData);
    return skinData;
  } catch (error) {
    console.error(`Error fetching skin "${skinName}":`, error);
    return null;
  }
}

async function createGame(skinNames) {
  if (!user) return;
  
  try {
    showLoading(createGameSubmitBtn);
    hideError(createGameError);
    
    const token = AuthClient.getToken();
    const response = await fetch(`${api}/dice/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        discordId: user.discordId,
        robloxUsername: user.robloxUsername,
        betSkins: skinNames
      })
    });
    
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || 'Failed to create game');
    }
    
    createGameModal.hide();
    await fetchActiveGames();
    await fetchUserInventory();
    
    selectedSkins = [];
    updateSelectedSkinsUI();
    
    showNotification(
      'Game Created',
      `Dice game created successfully with ${skinNames.length} skin${skinNames.length > 1 ? 's' : ''}!`,
      'View Games',
      () => {
        const title = document.querySelector('.section-title');
        if (title) title.scrollIntoView({ behavior: 'smooth' });
      }
    );
  } catch (error) {
    console.error('Error creating game:', error);
    showError(createGameError, error.message);
  } finally {
    hideLoading(createGameSubmitBtn, 'Create Game');
  }
}

async function joinGame(gameId, skinNames) {
  if (!user) return;
  
  try {
    showLoading(joinGameSubmitBtn);
    hideError(joinGameError);
    
    const token = AuthClient.getToken();
    const response = await fetch(`${api}/dice/join/${gameId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        discordId: user.discordId,
        robloxUsername: user.robloxUsername,
        betSkins: skinNames
      })
    });
    
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || 'Failed to join game');
    }
    
    joinGameModal.hide();
    
    const processedGameData = {
      ...data,
      creator: {
        ...data.creator,
        skins: data.creator.skins || data.creatorSkins || '-',
        skinValue: data.creator.skinValue || data.creatorSkinValue || 0
      },
      joiner: {
        ...data.joiner,
        skins: data.joiner.skins || data.joinerSkins || '-',
        skinValue: data.joiner.skinValue || data.joinerSkinValue || 0
      }
    };
    
    setTimeout(() => {
      showGameResult(processedGameData);
    }, 500);
    
    await Promise.all([
      fetchActiveGames(),
      fetchRecentGames(),
      fetchUserInventory()
    ]);
    
    joinSelectedSkins = [];
    updateJoinSelectedSkinsUI();
  } catch (error) {
    console.error('Error joining game:', error);
    showError(joinGameError, error.message);
  } finally {
    hideLoading(joinGameSubmitBtn, 'Join Game');
  }
}

async function cancelGame(gameId) {
  if (!user) return;
  
  try {
    const token = AuthClient.getToken();
    const response = await fetch(`${api}/dice/cancel/${gameId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        discordId: user.discordId
      })
    });
    
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || 'Failed to cancel game');
    }
    
    await Promise.all([
      fetchActiveGames(),
      fetchUserInventory()
    ]);
    
    showNotification(
      'Game Cancelled',
      'Your game has been cancelled and your skins have been returned to your inventory.',
      'OK',
      () => {}
    );
  } catch (error) {
    console.error('Error cancelling game:', error);
    showNotification(
      'Error',
      `Failed to cancel game: ${error.message}`,
      'OK',
      () => {}
    );
  }
}

function renderActiveGames() {
  activeGamesList.innerHTML = '';
  
  if (activeGames.length === 0) {
    noGamesMessage.style.display = 'block';
    return;
  }
  
  noGamesMessage.style.display = 'none';
  
  activeGames.forEach(game => {
    const gameElement = document.createElement('div');
    
    const betSkins = Array.isArray(game.betSkins) ? game.betSkins : [game.betSkins];
    const primarySkin = betSkins[0] || "Unknown Skin"; 
    
    const skinDetails = allSkins.find(skin => skin.name === primarySkin);
    const rarityClass = skinDetails ? getRarityColor(skinDetails.rarity) : 'secondary';
    const rarity = skinDetails?.rarity || 'Unknown';
    
    gameElement.innerHTML = `
      <div class="game-card">
        <div class="game-header">
          <div class="game-creator">
            <div class="creator-avatar">${game.creator.robloxUsername.charAt(0)}</div>
            <div>${game.creator.robloxUsername}</div>
          </div>
          <div class="game-status">
            <i class="fas fa-dice me-2"></i> Active
          </div>
        </div>
        <div class="game-body">
          <div class="bet-item">
            <img src="https://via.placeholder.com/80?text=Loading..."
                alt="${primarySkin}"
                class="skin-image">
            <div class="skin-details">
              <div class="skin-name">${primarySkin}</div>
              <div class="skin-value">${formatValue(game.skinValue)} value</div>
              <div class="skin-tag rarity-${rarity.toLowerCase()}">${rarity}</div>
            </div>
          </div>
          ${betSkins.length > 1 ? `<div style="font-size: 13px; color: var(--text-muted); margin-bottom: 8px;">+${betSkins.length - 1} more skin${betSkins.length > 2 ? 's' : ''}</div>` : ''}
          <div style="font-size: 13px; color: var(--text-muted); margin-bottom: 12px; margin-top: 8px;">
            <i class="far fa-clock"></i> ${formatDate(game.createdAt)}
          </div>
          <div class="game-actions">
            ${user && user.discordId === game.creator.discordId
              ? `<button class="btn btn-danger cancel-game-btn" data-game-id="${game.gameId}">Cancel Game</button>`
              : `<button class="btn btn-success join-game-btn" data-game-id="${game.gameId}">
                  <i class="fas fa-dice"></i> Roll the Dice
                </button>`
            }
          </div>
        </div>
      </div>
    `;
    
    activeGamesList.appendChild(gameElement);
    
    const imageContainer = gameElement.querySelector('.skin-image');
    if (imageContainer) {
      loadSkinImage(primarySkin, imageContainer);
    }
  });
  
  document.querySelectorAll('.join-game-btn').forEach(button => {
    button.addEventListener('click', () => {
      const gameId = button.getAttribute('data-game-id');
      openJoinGameModal(gameId);
    });
  });
  
  document.querySelectorAll('.cancel-game-btn').forEach(button => {
    button.addEventListener('click', () => {
      const gameId = button.getAttribute('data-game-id');
      if (confirm('Are you sure you want to cancel this game?')) {
        cancelGame(gameId);
      }
    });
  });
}

function renderRecentGames() {
  recentGamesList.innerHTML = '';
  
  if (recentGames.length === 0) {
    noRecentGames.style.display = 'block';
    return;
  }
  
  noRecentGames.style.display = 'none';
  
  recentGames.forEach(game => {
    const row = document.createElement('tr');
    
    if (!game.creator || !game.joiner || !game.winner) {
      console.error('Invalid game data in recent games:', game);
      return;
    }
    
    const creatorSkins = Array.isArray(game.creator.skins) && game.creator.skins.length > 0
      ? game.creator.skins.join(', ') 
      : 'No skins';
      
    const joinerSkins = Array.isArray(game.joiner.skins) && game.joiner.skins.length > 0
      ? game.joiner.skins.join(', ') 
      : 'No skins';
    
    const creatorRoll = game.creator.roll !== undefined ? parseInt(game.creator.roll) : 0;
    const joinerRoll = game.joiner.roll !== undefined ? parseInt(game.joiner.roll) : 0;
    
    row.innerHTML = `
      <td>${game.creator.robloxUsername || 'Unknown'}</td>
      <td><span class="badge bg-primary">${creatorRoll}</span></td>
      <td>${game.joiner.robloxUsername || 'Unknown'}</td>
      <td><span class="badge bg-danger">${joinerRoll}</span></td>
      <td><span class="badge bg-success">${game.winner.robloxUsername || 'Unknown'}</span></td>
      <td>${formatValue((game.creator.skinValue || 0) + (game.joiner.skinValue || 0))}</td>
      <td>${formatDate(game.completedAt || new Date())}</td>
      <td>
        <button class="btn btn-sm btn-info view-game-btn" data-game-id="${game.gameId}">Details</button>
      </td>
    `;
    
    recentGamesList.appendChild(row);
  });
  
  document.querySelectorAll('.view-game-btn').forEach(button => {
    button.addEventListener('click', async () => {
      const gameId = button.getAttribute('data-game-id');
      
      let game = recentGames.find(g => g.gameId === gameId);
      
      if (!game || !game.creator || !game.joiner || !game.winner) {
        game = await fetchGameDetails(gameId);
      }
      
      if (game) {
        showGameResult(game);
      } else {
        showNotification('Error', 'Could not load game details', 'OK', () => {});
      }
    });
  });
}

async function loadSkinImage(skinName, imageElement) {
  if (!skinName) {
    imageElement.src = 'https://via.placeholder.com/80?text=No+Image';
    return;
  }
  
  imageElement.src = 'https://via.placeholder.com/80?text=Loading...';
  
  try {
    const skinDetails = allSkins.find(skin => skin.name === skinName);
    
    if (skinDetails && skinDetails.image_url) {
      imageElement.src = skinDetails.image_url;
    } else {
      const response = await fetch(`${api}/skin/${encodeURIComponent(skinName)}`);
      
      if (response.ok) {
        const data = await response.json();
        
        if (data && data.image_url) {
          imageElement.src = data.image_url;
          
          if (!allSkins.some(s => s.name === skinName)) {
            allSkins.push(data);
          }
        } else {
          imageElement.src = 'https://via.placeholder.com/80?text=No+Image';
        }
      } else {
        imageElement.src = 'https://via.placeholder.com/80?text=No+Image';
      }
    }
  } catch (error) {
    console.error(`Error loading image for ${skinName}:`, error);
    imageElement.src = 'https://via.placeholder.com/80?text=No+Image';
  }
  
  imageElement.onerror = function() {
    this.onerror = null;
    this.src = 'https://via.placeholder.com/80?text=No+Image';
  };
}

function showNoGames(message) {
  gamesLoading.style.display = 'none';
  activeGamesList.innerHTML = '';
  noGamesMessage.textContent = message || 'No active games. Be the first to create one!';
  noGamesMessage.style.display = 'block';
}

function updateSkinSelects() {
  if (!userInventory || !userInventory.length) return;
  
  while (betSkinSelect.options.length > 1) {
    betSkinSelect.remove(1);
  }
  
  while (joinSkinSelect && joinSkinSelect.options.length > 1) {
    joinSkinSelect.remove(1);
  }
  
  const skinCounts = {};
  userInventory.forEach(skinName => {
    skinCounts[skinName] = (skinCounts[skinName] || 0) + 1;
  });
  
  const uniqueSkins = [...new Set(userInventory)];
  
  uniqueSkins.forEach(skinName => {
    const skinDetails = allSkins.find(skin => skin.name === skinName);
    const count = skinCounts[skinName];
    
    const createOption = document.createElement('option');
    createOption.value = skinName;
    createOption.textContent = skinName;
    
    if (skinDetails) {
      createOption.textContent = `${skinName} (${formatValue(skinDetails.value)} value)`;
      
      if (count > 1) {
        createOption.textContent += ` [${count}x]`;
      }
      
      createOption.dataset.rarity = skinDetails.rarity;
      createOption.dataset.value = skinDetails.value;
      createOption.dataset.image = skinDetails.image_url || '';
      createOption.dataset.count = count;
    } else if (count > 1) {
      createOption.textContent += ` [${count}x]`;
    }
    
    betSkinSelect.appendChild(createOption);
    
    if (joinSkinSelect) {
      const joinOption = document.createElement('option');
      joinOption.value = skinName;
      joinOption.textContent = skinName;
      
      if (skinDetails) {
        joinOption.textContent = `${skinName} (${formatValue(skinDetails.value)} value)`;
        
        if (count > 1) {
          joinOption.textContent += ` [${count}x]`;
        }
        
        joinOption.dataset.rarity = skinDetails.rarity;
        joinOption.dataset.value = skinDetails.value;
        joinOption.dataset.image = skinDetails.image_url || '';
        joinOption.dataset.count = count;
      } else if (count > 1) {
        joinOption.textContent += ` [${count}x]`;
      }
      
      joinSkinSelect.appendChild(joinOption);
    }
  });
}

function addSelectedSkin() {
  const selectedOption = betSkinSelect.options[betSkinSelect.selectedIndex];
  if (!selectedOption.value) return;
  
  const skinName = selectedOption.value;
  const alreadySelectedCount = selectedSkins.filter(skin => skin.name === skinName).length;
  const inventoryCount = userInventory.filter(s => s === skinName).length;
  
  if (alreadySelectedCount >= inventoryCount) {
    showError(createGameError, `You only have ${inventoryCount} copy/copies of ${skinName} in your inventory`);
    return;
  }
  
  const skinDetails = allSkins.find(skin => skin.name === skinName) || {
    name: skinName,
    value: parseInt(selectedOption.dataset.value || 0),
    rarity: selectedOption.dataset.rarity || 'Common',
    image_url: selectedOption.dataset.image || ''
  };
  
  selectedSkins.push(skinDetails);
  updateSelectedSkinsUI();
  betSkinSelect.value = '';
  
  if (skinPreview) skinPreview.style.display = 'none';
}

function updateSelectedSkinsUI() {
  if (selectedSkins.length === 0) {
    selectedSkinsContainer.style.display = 'none';
    return;
  }
  
  selectedSkinsContainer.style.display = 'block';
  selectedSkinsList.innerHTML = '';
  
  const skinCounts = {};
  selectedSkins.forEach(skin => {
    skinCounts[skin.name] = (skinCounts[skin.name] || 0) + 1;
  });
  
  const uniqueSkins = [];
  let totalValue = 0;
  
  selectedSkins.forEach(skin => {
    totalValue += skin.value;
    
    if (!uniqueSkins.some(s => s.name === skin.name)) {
      uniqueSkins.push(skin);
    }
  });
  
  uniqueSkins.forEach(skin => {
    const count = skinCounts[skin.name];
    const skinItem = document.createElement('div');
    skinItem.className = 'selected-skin-item';
    skinItem.style.display = 'flex';
    skinItem.style.alignItems = 'center';
    skinItem.style.justifyContent = 'space-between';
    skinItem.style.padding = '8px 12px';
    skinItem.style.backgroundColor = 'var(--bg-light)';
    skinItem.style.borderRadius = '6px';
    skinItem.style.marginBottom = '8px';
    
    const countBadge = count > 1 ?
      `<span style="background-color: var(--bg-dark); padding: 2px 6px; border-radius: 4px; font-size: 11px; margin-left: 6px;">${count}x</span>`
      : '';
    
    skinItem.innerHTML = `
      <div style="display: flex; align-items: center; gap: 8px;">
        <div style="width: 32px; height: 32px; border-radius: 4px; overflow: hidden;">
          <img src="${skin.image_url || 'https://via.placeholder.com/32'}" alt="${skin.name}" style="width: 100%; height: 100%; object-fit: cover;">
        </div>
        <div>
          <div style="font-weight: 500; display: flex; align-items: center;">
            ${skin.name} ${countBadge}
          </div>
          <div style="font-size: 12px; color: var(--text-muted);">${formatValue(skin.value * count)} value (${formatValue(skin.value)} each)</div>
        </div>
      </div>
      <button type="button" class="btn btn-sm btn-outline remove-all-skin-btn" data-name="${skin.name}" style="padding: 4px 8px;">
        <i class="fas fa-times"></i>
      </button>
    `;
    
    selectedSkinsList.appendChild(skinItem);
  });
  
  selectedSkinsTotalValue.textContent = formatValue(totalValue);
  
  document.querySelectorAll('.remove-all-skin-btn').forEach(button => {
    button.addEventListener('click', () => {
      const skinName = button.getAttribute('data-name');
      selectedSkins = selectedSkins.filter(skin => skin.name !== skinName);
      updateSelectedSkinsUI();
    });
  });
}

function addJoinSelectedSkin() {
  const selectedOption = joinSkinSelect.options[joinSkinSelect.selectedIndex];
  if (!selectedOption.value) return;
  
  const skinName = selectedOption.value;
  const selectedCount = joinSelectedSkins.filter(s => s.name === skinName).length;
  const inventoryCount = userInventory.filter(s => s === skinName).length;
  
  if (selectedCount >= inventoryCount) {
    showError(joinGameError, `You've already selected all available copies of ${skinName}`);
    return;
  }
  
  const skinDetails = allSkins.find(skin => skin.name === skinName) || {
    name: skinName,
    value: parseInt(selectedOption.dataset.value || 0),
    rarity: selectedOption.dataset.rarity || 'Common',
    image_url: selectedOption.dataset.image || ''
  };
  
  joinSelectedSkins.push(skinDetails);
  updateJoinSelectedSkinsUI();
  joinSkinSelect.value = '';
  
  if (joinSkinPreview) joinSkinPreview.style.display = 'none';
}

function updateJoinSelectedSkinsUI() {
  if (joinSelectedSkins.length === 0) {
    joinSelectedSkinsContainer.style.display = 'none';
    return;
  }
  
  joinSelectedSkinsContainer.style.display = 'block';
  joinSelectedSkinsList.innerHTML = '';
  
  const skinCounts = {};
  joinSelectedSkins.forEach(skin => {
    skinCounts[skin.name] = (skinCounts[skin.name] || 0) + 1;
  });
  
  const uniqueSkins = [];
  let totalValue = 0;
  
  joinSelectedSkins.forEach(skin => {
    totalValue += skin.value;
    
    if (!uniqueSkins.some(s => s.name === skin.name)) {
      uniqueSkins.push(skin);
    }
  });
  
  uniqueSkins.forEach(skin => {
    const count = skinCounts[skin.name];
    const skinItem = document.createElement('div');
    skinItem.style.display = 'flex';
    skinItem.style.alignItems = 'center';
    skinItem.style.justifyContent = 'space-between';
    skinItem.style.padding = '8px';
    skinItem.style.backgroundColor = '#1a2234';
    skinItem.style.borderRadius = '4px';
    skinItem.style.marginBottom = '8px';
    
    const countBadge = count > 1 ?
      `<span style="background-color: #334155; padding: 2px 6px; border-radius: 4px; font-size: 11px; margin-left: 6px;">${count}x</span>`
      : '';
    
    skinItem.innerHTML = `
      <div style="display: flex; align-items: center; gap: 8px;">
        <div style="width: 32px; height: 32px; border-radius: 4px; overflow: hidden; background-color: #334155;">
          <img src="${skin.image_url || 'https://via.placeholder.com/32'}" alt="${skin.name}" style="width: 100%; height: 100%; object-fit: cover;">
        </div>
        <div>
          <div style="font-weight: 500; color: #f8fafc; display: flex; align-items: center;">
            ${skin.name} ${countBadge}
          </div>
          <div style="font-size: 12px; color: #94a3b8;">${formatValue(skin.value * count)} value (${formatValue(skin.value)} each)</div>
        </div>
      </div>
      <button type="button" class="remove-all-join-skin-btn" data-name="${skin.name}" style="background: transparent; border: none; color: #94a3b8; cursor: pointer;">
        <i class="fas fa-times"></i>
      </button>
    `;
    
    joinSelectedSkinsList.appendChild(skinItem);
  });
  
  joinSelectedSkinsTotalValue.textContent = formatValue(totalValue);
  
  document.querySelectorAll('.remove-all-join-skin-btn').forEach(button => {
    button.addEventListener('click', () => {
      const skinName = button.getAttribute('data-name');
      joinSelectedSkins = joinSelectedSkins.filter(skin => skin.name !== skinName);
      updateJoinSelectedSkinsUI();
      updateValueIndicator();
    });
  });
  
  updateValueIndicator();
}

function updateValueIndicator() {
  const game = activeGames.find(g => g.gameId === selectedGameId);
  if (!game || !joinValueIndicator) return;
  
  const totalSelectedValue = joinSelectedSkins.reduce((sum, skin) => sum + skin.value, 0);
  const requiredValue = game.skinValue;
  const minRequired = requiredValue * 0.9;
  const maxAllowed = requiredValue * 1.1;
  
  joinValueIndicator.style.display = 'block';
  
  if (totalSelectedValue >= minRequired && totalSelectedValue <= maxAllowed) {
    joinValueIndicator.innerHTML = `
      <div style="display: flex; align-items: center; justify-content: center; gap: 6px;">
        <i class="fas fa-check-circle" style="color: var(--success);"></i>
        <span>Value requirement met (${formatValue(totalSelectedValue)} / ${formatValue(requiredValue)})</span>
      </div>
    `;
    joinValueIndicator.style.backgroundColor = 'rgba(16, 185, 129, 0.1)';
    joinValueIndicator.style.borderLeft = '3px solid var(--success)';
  } else if (totalSelectedValue < minRequired) {
    joinValueIndicator.innerHTML = `
      <div style="display: flex; align-items: center; justify-content: center; gap: 6px;">
        <i class="fas fa-exclamation-circle" style="color: var(--warning);"></i>
        <span>Need at least ${formatValue(minRequired)} value (currently ${formatValue(totalSelectedValue)})</span>
      </div>
    `;
    joinValueIndicator.style.backgroundColor = 'rgba(245, 158, 11, 0.1)';
    joinValueIndicator.style.borderLeft = '3px solid var(--warning)';
  } else {
    joinValueIndicator.innerHTML = `
      <div style="display: flex; align-items: center; justify-content: center; gap: 6px;">
        <i class="fas fa-exclamation-circle" style="color: var(--warning);"></i>
        <span>Value too high, maximum is ${formatValue(maxAllowed)} (currently ${formatValue(totalSelectedValue)})</span>
      </div>
    `;
    joinValueIndicator.style.backgroundColor = 'rgba(245, 158, 11, 0.1)';
    joinValueIndicator.style.borderLeft = '3px solid var(--warning)';
  }
}

function filterJoinSkinOptions(targetValue) {
  const totalSelectedValue = joinSelectedSkins.reduce((sum, skin) => sum + skin.value, 0);
  const minRequired = targetValue * 0.9;
  const maxAllowed = targetValue * 1.1;
  
  const selectedCounts = {};
  joinSelectedSkins.forEach(skin => {
    selectedCounts[skin.name] = (selectedCounts[skin.name] || 0) + 1;
  });
  
  const inventoryCounts = {};
  userInventory.forEach(skinName => {
    inventoryCounts[skinName] = (inventoryCounts[skinName] || 0) + 1;
  });
  
  Array.from(joinSkinSelect.options).forEach(option => {
    if (option.value === '') return;
    
    const skinName = option.value;
    const skinDetails = allSkins.find(skin => skin.name === skinName);
    const optionValue = skinDetails ? Number(skinDetails.value) : 0;
    
    const selectedCount = selectedCounts[skinName] || 0;
    const inventoryCount = inventoryCounts[skinName] || 0;
    
    let isDisabled = selectedCount >= inventoryCount;
    let disabledReason = '';
    
    if (isDisabled) {
      disabledReason = "All copies selected";
    } else if (totalSelectedValue >= maxAllowed) {
      isDisabled = true;
      disabledReason = "Maximum value reached";
    }
    
    option.disabled = isDisabled;
    
    if (skinDetails) {
      const countText = inventoryCount > 1 ? `[${inventoryCount - selectedCount}/${inventoryCount}x]` : '';
      option.textContent = `${skinName} (${formatValue(skinDetails.value)} value)${countText}`;
    } else {
      option.textContent = skinName;
    }
    
    if (isDisabled && disabledReason) {
      option.textContent += ` (${disabledReason})`;
    }
  });
  
  updateValueIndicator();
}

async function handleBetSkinChange() {
  const selected = betSkinSelect.options[betSkinSelect.selectedIndex];
  
  if (selected.value) {
    if (skinName) skinName.textContent = selected.value;
    
    let skinDetails = allSkins.find(skin => skin.name === selected.value);
    
    if (!skinDetails || !skinDetails.image_url) {
      try {
        const response = await fetch(`${api}/skin/${encodeURIComponent(selected.value)}`);
        
        if (response.ok) {
          skinDetails = await response.json();
          
          if (!allSkins.some(s => s.name === selected.value)) {
            allSkins.push(skinDetails);
          }
        }
      } catch (error) {
        console.error('Error fetching skin details:', error);
      }
    }
    
    if (skinDetails) {
      if (skinRarity) {
        skinRarity.textContent = skinDetails.rarity || 'Common';
        skinRarity.className = `badge bg-${getRarityColor(skinDetails.rarity || 'common')} me-2`;
      }
      
      if (skinValue) skinValue.textContent = `${formatValue(skinDetails.value || 0)} value`;
      
      if (skinImage) {
        if (skinDetails.image_url) {
          skinImage.src = skinDetails.image_url;
        } else {
          skinImage.src = 'https://via.placeholder.com/80';
        }
      }
    } else {
      if (skinRarity) {
        skinRarity.textContent = selected.dataset.rarity || 'Common';
        skinRarity.className = `badge bg-${getRarityColor(selected.dataset.rarity || 'common')} me-2`;
      }
      
      if (skinValue) skinValue.textContent = `${formatValue(selected.dataset.value || 0)} value`;
      
      if (skinImage) {
        if (selected.dataset.image) {
          skinImage.src = selected.dataset.image;
        } else {
          skinImage.src = 'https://via.placeholder.com/80';
        }
      }
    }
    
    if (skinPreview) skinPreview.style.display = 'block';
  } else {
    if (skinPreview) skinPreview.style.display = 'none';
  }
}

async function handleJoinSkinChange() {
  const selected = joinSkinSelect.options[joinSkinSelect.selectedIndex];
  
  if (selected.value) {
    if (joinSkinName) joinSkinName.textContent = selected.value;
    
    let skinDetails = allSkins.find(skin => skin.name === selected.value);
    
    if (!skinDetails || !skinDetails.image_url) {
      try {
        const response = await fetch(`${api}/skin/${encodeURIComponent(selected.value)}`);
        
        if (response.ok) {
          skinDetails = await response.json();
          
          if (!allSkins.some(s => s.name === selected.value)) {
            allSkins.push(skinDetails);
          }
        }
      } catch (error) {
        console.error('Error fetching skin details:', error);
      }
    }
    
    if (skinDetails) {
      if (joinSkinRarity) {
        joinSkinRarity.textContent = skinDetails.rarity || 'Common';
        joinSkinRarity.className = `badge bg-${getRarityColor(skinDetails.rarity || 'common')} me-2`;
      }
      
      if (joinSkinValue) joinSkinValue.textContent = `${formatValue(skinDetails.value || 0)} value`;
      
      if (joinSkinImage) {
        if (skinDetails.image_url) {
          joinSkinImage.src = skinDetails.image_url;
        } else {
          joinSkinImage.src = 'https://via.placeholder.com/80';
        }
      }
    } else {
      if (joinSkinRarity) {
        joinSkinRarity.textContent = selected.dataset.rarity || 'Common';
        joinSkinRarity.className = `badge bg-${getRarityColor(selected.dataset.rarity || 'common')} me-2`;
      }
      
      if (joinSkinValue) joinSkinValue.textContent = `${formatValue(selected.dataset.value || 0)} value`;
      
      if (joinSkinImage) {
        if (selected.dataset.image) {
          joinSkinImage.src = selected.dataset.image;
        } else {
          joinSkinImage.src = 'https://via.placeholder.com/80';
        }
      }
    }
    
    if (joinSkinPreview) joinSkinPreview.style.display = 'block';
  } else {
    if (joinSkinPreview) joinSkinPreview.style.display = 'none';
  }
}

function openCreateGameModal() {
  if (!user) {
    AuthClient.login();
    return;
  }
  
  createGameForm.reset();
  hideError(createGameError);
  
  if (skinPreview) {
    skinPreview.style.display = 'none';
  }
  
  selectedSkins = [];
  updateSelectedSkinsUI();
  
  createGameModal.show();
}

function openJoinGameModal(gameId) {
  if (!user) {
    AuthClient.login();
    return;
  }
  
  selectedGameId = gameId;
  const game = activeGames.find(g => g.gameId === gameId);
  
  if (!game) {
    alert('Game not found. It may have been cancelled or completed.');
    return;
  }
  
  creatorUsername.textContent = game.creator.robloxUsername;
  
  if (creatorAvatar) {
    creatorAvatar.textContent = game.creator.robloxUsername.charAt(0).toUpperCase();
  }
  
  creatorSkinsList.innerHTML = '';
  
  const creatorSkins = Array.isArray(game.betSkins) ? game.betSkins :
                      (game.betSkin ? [game.betSkin] : []);
  
  Promise.all(creatorSkins.map(async (skinName) => {
    const skinDetails = await fetchAndCacheSkin(skinName);
    
    const skinItem = document.createElement('div');
    skinItem.style.display = 'flex';
    skinItem.style.alignItems = 'center';
    skinItem.style.gap = '8px';
    skinItem.style.marginBottom = '8px';
    
    skinItem.innerHTML = `
      <div style="width: 32px; height: 32px; border-radius: 4px; overflow: hidden; background-color: #334155;">
        <img src="${skinDetails?.image_url || 'https://via.placeholder.com/32'}" alt="${skinName}" style="width: 100%; height: 100%; object-fit: cover;">
      </div>
      <div>
        <div style="font-weight: 500; color: #f8fafc;">${skinName}</div>
        <div style="font-size: 12px; color: #94a3b8;">${formatValue(skinDetails?.value || 0)} value</div>
      </div>
    `;
    
    creatorSkinsList.appendChild(skinItem);
  }));
  
  joinGameForm.reset();
  hideError(joinGameError);
  
  if (joinSkinPreview) joinSkinPreview.style.display = 'none';
  
  joinSelectedSkins = [];
  updateJoinSelectedSkinsUI();
  
  filterJoinSkinOptions(game.skinValue);
  
  joinGameModal.show();
}

function showGameResult(game) {
  if (!game || !game.creator || !game.joiner) {
    console.error('Invalid game object:', game);
    return;
  }

  if (creatorDice) {
    creatorDice.classList.remove('rolling', 'rerolling', 'dice-winner');
    creatorDice.textContent = '?'; 
  }
  
  if (joinerDice) {
    joinerDice.classList.remove('rolling', 'rerolling', 'dice-winner');
    joinerDice.textContent = '?';
  }
  
  if (resultCreatorName) resultCreatorName.textContent = game.creator.robloxUsername;
  if (resultJoinerName) resultJoinerName.textContent = game.joiner.robloxUsername;
  
  let creatorSkinsList = '';
  if (Array.isArray(game.creator.skins) && game.creator.skins.length > 0) {
    creatorSkinsList = game.creator.skins.join(', ');
  } else if (typeof game.creator.skins === 'string') {
    creatorSkinsList = game.creator.skins;
  } else if (game.creatorSkins) {
    creatorSkinsList = Array.isArray(game.creatorSkins) 
      ? game.creatorSkins.join(', ') 
      : String(game.creatorSkins);
  } else {
    creatorSkinsList = '-';
  }
  
  let joinerSkinsList = '';
  if (Array.isArray(game.joiner.skins) && game.joiner.skins.length > 0) {
    joinerSkinsList = game.joiner.skins.join(', ');
  } else if (typeof game.joiner.skins === 'string') {
    joinerSkinsList = game.joiner.skins;
  } else if (game.joinerSkins) {
    joinerSkinsList = Array.isArray(game.joinerSkins) 
      ? game.joinerSkins.join(', ') 
      : String(game.joinerSkins);
  } else {
    joinerSkinsList = '-';
  }
  
  if (resultCreatorSkins) resultCreatorSkins.textContent = creatorSkinsList || '-';
  
  const creatorValue = game.creator.skinValue || 
                      game.creator.skinsValue || 
                      game.creatorSkinValue || 
                      game.creator.value || 0;
                      
  if (resultCreatorValue) resultCreatorValue.textContent = formatValue(creatorValue);
  
  if (resultJoinerSkins) resultJoinerSkins.textContent = joinerSkinsList || '-';
  
  const joinerValue = game.joiner.skinValue || 
                     game.joiner.skinsValue || 
                     game.joinerSkinValue || 
                     game.joiner.value || 0;
                     
  if (resultJoinerValue) resultJoinerValue.textContent = formatValue(joinerValue);
  
  const creatorCardEl = document.querySelector('.creator-card');
  const joinerCardEl = document.querySelector('.joiner-card');
  
  if (creatorCardEl) creatorCardEl.classList.remove('winner', 'loser');
  if (joinerCardEl) joinerCardEl.classList.remove('winner', 'loser');
  
  if (winnerInfo) winnerInfo.style.visibility = 'hidden';
  
  if (creatorRollDisplay) creatorRollDisplay.textContent = '?';
  if (joinerRollDisplay) joinerRollDisplay.textContent = '?';
  
  if (resultTitle) {
    resultTitle.textContent = 'Dice Game Result';
    resultTitle.className = 'modal-title';
  }
  
  if (resultHeader) {
    resultHeader.className = 'modal-header';
  }
  
  const tieMessage = document.getElementById('tie-message');
  if (tieMessage) {
    tieMessage.classList.remove('show');
  }
  
  gameResultModal.show();
  
  const animateDiceRoll = () => {
    const creatorRoll = game.creator.roll !== undefined ? parseInt(game.creator.roll) : 0;
    const joinerRoll = game.joiner.roll !== undefined ? parseInt(game.joiner.roll) : 0;
    
    const wasTie = game.tieResolved;
    
    if (creatorDice) creatorDice.classList.add('rolling');
    if (joinerDice) joinerDice.classList.add('rolling');
    
    let currentRoll = 0;
    const numRolls = 10; 
    
    const rollInterval = setInterval(() => {
      currentRoll++;
      
      const randomCreatorRoll = Math.floor(Math.random() * 6) + 1;
      const randomJoinerRoll = Math.floor(Math.random() * 6) + 1;
      
      if (creatorDice && currentRoll < numRolls) {
        creatorDice.textContent = randomCreatorRoll;
      } else if (creatorDice && currentRoll === numRolls) {
        creatorDice.textContent = creatorRoll;
        if (creatorRollDisplay) creatorRollDisplay.textContent = creatorRoll;
      }
      
      if (joinerDice && currentRoll < numRolls) {
        joinerDice.textContent = randomJoinerRoll;
      } else if (joinerDice && currentRoll === numRolls) {
        joinerDice.textContent = joinerRoll;
        if (joinerRollDisplay) joinerRollDisplay.textContent = joinerRoll;
      }
      
      if (currentRoll >= numRolls) {
        clearInterval(rollInterval);
      }
    }, 100); 
    
    setTimeout(() => {
      if (creatorDice) creatorDice.classList.remove('rolling');
      if (joinerDice) joinerDice.classList.remove('rolling');
      
      if (wasTie && tieMessage) {
        tieMessage.classList.add('show');
        
        setTimeout(() => {
          if (creatorDice) creatorDice.classList.add('rerolling');
          if (joinerDice) joinerDice.classList.add('rerolling');
          
          let rerollCount = 0;
          const rerollInterval = setInterval(() => {
            rerollCount++;
            
            const randomCreatorReroll = Math.floor(Math.random() * 6) + 1;
            const randomJoinerReroll = Math.floor(Math.random() * 6) + 1;
            
            if (creatorDice && rerollCount < 5) {
              creatorDice.textContent = randomCreatorReroll;
            } else if (creatorDice && rerollCount === 5) {
              creatorDice.textContent = creatorRoll;
            }
            
            if (joinerDice && rerollCount < 5) {
              joinerDice.textContent = randomJoinerReroll;
            } else if (joinerDice && rerollCount === 5) {
              joinerDice.textContent = joinerRoll;
            }
            
            if (rerollCount >= 5) {
              clearInterval(rerollInterval);
            }
          }, 80);
          
          setTimeout(() => {
            if (creatorDice) creatorDice.classList.remove('rerolling');
            if (joinerDice) joinerDice.classList.remove('rerolling');
            
            if (tieMessage) tieMessage.classList.remove('show');
            
            finalizeDiceResult();
          }, 1000);
        }, 1500);
      } else {
        finalizeDiceResult();
      }
    }, 1700);
  };
  
  const finalizeDiceResult = () => {
    const creatorRoll = game.creator.roll !== undefined ? parseInt(game.creator.roll) : 0;
    const joinerRoll = game.joiner.roll !== undefined ? parseInt(game.joiner.roll) : 0;
    

    let actualWinnerIsCreator;
    if (game.winner && game.winner.discordId) {
      actualWinnerIsCreator = game.winner.discordId === game.creator.discordId;
    } else {
      actualWinnerIsCreator = creatorRoll > joinerRoll;
    }
    
    if (creatorCardEl) creatorCardEl.classList.add(actualWinnerIsCreator ? 'winner' : 'loser');
    if (joinerCardEl) joinerCardEl.classList.add(actualWinnerIsCreator ? 'loser' : 'winner');
    
    if (creatorDice && actualWinnerIsCreator) creatorDice.classList.add('dice-winner');
    if (joinerDice && !actualWinnerIsCreator) joinerDice.classList.add('dice-winner');
    
    if (winnerInfo) {
      const winnerName = actualWinnerIsCreator ? game.creator.robloxUsername : game.joiner.robloxUsername;
      
      winnerInfo.textContent = `${winnerName} won with ${actualWinnerIsCreator ? creatorRoll : joinerRoll} vs ${actualWinnerIsCreator ? joinerRoll : creatorRoll}!`;
      winnerInfo.style.visibility = 'visible';
    }
    
    if (user && resultTitle) {
      const userWon = (actualWinnerIsCreator && game.creator.discordId === user.discordId) || 
                     (!actualWinnerIsCreator && game.joiner.discordId === user.discordId);
                     
      if (userWon) {
        resultTitle.textContent = '✨ YOU WON! ✨';
        resultTitle.className = 'modal-title text-success';
        
        if (resultHeader) {
          resultHeader.className = 'modal-header bg-success';
        }
      } else if (user.discordId === game.creator.discordId || user.discordId === game.joiner.discordId) {
        resultTitle.textContent = 'You Lost';
        resultTitle.className = 'modal-title text-danger';
        
        if (resultHeader) {
          resultHeader.className = 'modal-header bg-danger';
        }
      } else {
        resultTitle.textContent = `Dice Game Result`;
        resultTitle.className = 'modal-title';
        
        if (resultHeader) {
          resultHeader.className = 'modal-header';
        }
      }
    }
  };
  
  setTimeout(animateDiceRoll, 500);
}

function handleCreateGame(event) {
  event.preventDefault();
  
  if (selectedSkins.length === 0) {
    showError(createGameError, 'Please select at least one skin to bet');
    return;
  }
  
  const skinNames = selectedSkins.map(skin => skin.name);
  createGame(skinNames);
}

function handleJoinGame(event) {
  event.preventDefault();
  
  if (joinSelectedSkins.length === 0) {
    showError(joinGameError, 'Please select at least one skin to bet');
    return;
  }
  
  const game = activeGames.find(g => g.gameId === selectedGameId);
  
  if (!game) {
    showError(joinGameError, 'Game not found');
    return;
  }
  
  const totalValue = joinSelectedSkins.reduce((sum, skin) => sum + skin.value, 0);
  const minRequired = game.skinValue * 0.9;
  const maxAllowed = game.skinValue * 1.1;
  
  if (totalValue < minRequired) {
    showError(joinGameError, `Total value (${formatValue(totalValue)}) must be at least ${formatValue(minRequired)}`);
    return;
  }
  
  if (totalValue > maxAllowed) {
    showError(joinGameError, `Total value (${formatValue(totalValue)}) cannot exceed ${formatValue(maxAllowed)}`);
    return;
  }
  
  const skinNames = joinSelectedSkins.map(skin => skin.name);
  joinGame(selectedGameId, skinNames);
}

async function updateAuthUI() {
  try {
    user = await AuthClient.getCurrentUser();
    
    if (user) {
      if (userInfo) userInfo.style.display = 'flex';
      if (loginBtn) loginBtn.style.display = 'none';
      if (usernameDisplay) usernameDisplay.textContent = user.robloxUsername;
      if (userAvatar) userAvatar.textContent = user.robloxUsername.charAt(0).toUpperCase();
      
      if (loginRequiredCard) {
        loginRequiredCard.style.display = 'none';
      }
      
      if (gamesContent) {
        gamesContent.style.display = 'block';
      }
      
      await fetchUserInventory();
    } else {
      if (userInfo) userInfo.style.display = 'none';
      if (loginBtn) loginBtn.style.display = 'flex';
      
      if (loginRequiredCard) {
        loginRequiredCard.style.display = 'block';
      }
      
      if (gamesContent) {
        gamesContent.style.display = 'none';
      }
    }
  } catch (error) {
    console.error('Error updating auth UI:', error);
  }
}

async function checkForGameUpdates() {
  if (!user) return;
  
  try {
    const currentTime = Date.now();
    const lastPollTime = parseInt(localStorage.getItem('last_dice_poll_time') || '0');
    
    if (currentTime - lastPollTime < 3000) {
      return;
    }
    
    localStorage.setItem('last_dice_poll_time', currentTime.toString());
    
    const token = AuthClient.getToken();
    const response = await fetch(`${api}/notifications?unread=true`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (!response.ok) return;
    
    const data = await response.json();
    if (!data.notifications || data.notifications.length === 0) {
      return;
    }
    
    const latestNotification = data.notifications[0];
    
    for (const notification of data.notifications) {
      try {
        await fetch(`${api}/notifications/${notification.id}/read`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
      } catch (markError) {
        console.error(`Failed to mark notification ${notification.id} as read:`, markError);
      }
    }
    
    if (latestNotification.content.includes('dice game') && latestNotification.reference_id) {
      const gameData = await fetchGameDetails(latestNotification.reference_id);
      
      if (gameData && gameData.status === 'completed' && gameData.creator && gameData.joiner) {
        showGameResult(gameData);
        
        await Promise.all([
          fetchActiveGames(),
          fetchRecentGames(),
          fetchUserInventory()
        ]);
      }
    }
  } catch (error) {
    console.error('Error checking for game updates:', error);
  }
}

async function fetchGameDetails(gameId) {
  try {
    const response = await fetch(`${api}/dice/game/${gameId}`);
    if (!response.ok) {
      throw new Error('Failed to fetch game details');
    }
    
    const gameData = await response.json();
    
    return {
      ...gameData,
      creator: {
        ...gameData.creator,
        skins: gameData.creator.skins || gameData.creatorSkins || '-',
        skinValue: gameData.creator.skinValue || gameData.creatorSkinValue || 0,
        roll: gameData.creator.roll || gameData.creatorRoll || 0
      },
      joiner: {
        ...gameData.joiner,
        skins: gameData.joiner.skins || gameData.joinerSkins || '-',
        skinValue: gameData.joiner.skinValue || gameData.joinerSkinValue || 0,
        roll: gameData.joiner.roll || gameData.joinerRoll || 0
      }
    };
  } catch (error) {
    console.error('Error fetching game details:', error);
    return null;
  }
}

async function init() {
  await updateAuthUI();
  
  await Promise.all([
    fetchActiveGames(),
    fetchRecentGames(),
    fetchSkins()
  ]);
  
  if (loginBtn) {
    loginBtn.addEventListener('click', () => AuthClient.login());
  }
  
  if (loginBtnCard) {
    loginBtnCard.addEventListener('click', () => AuthClient.login());
  }
  
  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => AuthClient.logout());
  }
  
  if (createGameBtn) {
    createGameBtn.addEventListener('click', openCreateGameModal);
  }
  
  if (addSkinBtn) {
    addSkinBtn.addEventListener('click', addSelectedSkin);
  }
  
  if (addJoinSkinBtn) {
    addJoinSkinBtn.addEventListener('click', addJoinSelectedSkin);
  }
  
  if (createGameSubmitBtn) {
    createGameSubmitBtn.addEventListener('click', handleCreateGame);
  }
  
  if (betSkinSelect) {
    betSkinSelect.addEventListener('change', async () => await handleBetSkinChange());
  }
  
  if (joinGameSubmitBtn) {
    joinGameSubmitBtn.addEventListener('click', handleJoinGame);
  }
  
  if (joinSkinSelect) {
    joinSkinSelect.addEventListener('change', async () => await handleJoinSkinChange());
  }
  
  if (playAgainBtn) {
    playAgainBtn.addEventListener('click', () => {
      gameResultModal.hide();
      openCreateGameModal();
    });
  }
  
  setInterval(fetchActiveGames, 5000);
  setInterval(checkForGameUpdates, 3000);
}