// Otomatik dil: tarayıcı dilinden seçilir, dil seçici YOK. Bilinmeyen dil → İngilizce.
export type Lang = 'tr' | 'en' | 'es' | 'fr' | 'de' | 'pt';

import type { BonusKind } from './constants';

export function resolveLang(tag: string | undefined | null): Lang {
  const t = (tag ?? '').toLowerCase();
  if (t.startsWith('tr')) return 'tr';
  if (t.startsWith('es')) return 'es';
  if (t.startsWith('fr')) return 'fr';
  if (t.startsWith('de')) return 'de';
  if (t.startsWith('pt')) return 'pt';
  return 'en';
}

export function detectLang(): Lang {
  try {
    const nav = globalThis.navigator as Navigator | undefined;
    const tags = [nav?.language, ...((nav as unknown as { languages?: string[] })?.languages ?? [])];
    for (const tag of tags) {
      if (!tag) continue;
      const p = tag.toLowerCase().slice(0, 2);
      if (p === 'tr' || p === 'es' || p === 'fr' || p === 'de' || p === 'pt') return p;
    }
  } catch { /* İngilizce varsay */ }
  return 'en';
}

export interface Texts {
  docTitle: string;
  nickname: string; nicknamePh: string;
  liveArena: string; practice: string; playNow: string;
  sessionScores: string; thisVisit: string;
  connecting: string; joiningRoom: string; cancel: string; back: string;
  gameOver: string; finalScore: string; playAgain: string; backToMenu: string; betterLuck: string;
  deathBump: string; deathEdge: string;
  pause: string; resume: string; mute: string; unmute: string; leaveArena: string;
  expandLb: string; collapseLb: string;
  solo: string; live: string; bots: string; leader: string;
  invite: string; copied: string; controlsHint: string;
  you: string; sizeLeader: string; scoreTag: string; sizeTag: string;
  shop: string; account: string; skinTab: string; hatTab: string; glassesTab: string;
  equipped: string; equip: string; goldNote: string;
  catAll: string; catBasit: string; catCizgili: string; catDesenli: string; catBayraklar: string;
  guest: string; guestWithName: string; guestPlain: string; sessionNote: string; active: string;
  googleSoon: string; googleDesc: string; googleNote: string;
  noticeName: string; noticeRoom: string; waitingRespawn: string; respawnRetry: string; copyManual: string;
  srvNoResponse: string; srvUnreachable: string; connEnded: string; connTimeout: string;
  sessionMismatch: string; srvBadData: string; connCancelled: string;
  arenaAddr: string; arenaTls: string;
  boostBtn: string; arenaAria: string;
  frenzyCombo: string; frenzyMult: string; multEnded: string; killNotice: string;
  shield: string; bonusSpeed: string; bonusCoin: string;
  patSolid: string; patCandy: string; patFreckles: string; patStripes: string; patDots: string;
  flagWord: string; cTR: string; cAZ: string; cDE: string; cFR: string; cUS: string; cBR: string; cGB: string; cIT: string;
  hatNone: string; hatParty: string; hatBeanie: string; hatCowboy: string; hatHelmet: string; hatWizard: string; hatCrown: string;
  glNone: string; glCool: string; glSun: string; glMono: string; glStar: string; glHeart: string;
}

const en: Texts = {
  docTitle: 'Wormate — Eat. Grow. Dominate.',
  nickname: 'Nickname', nicknamePh: 'Enter name...',
  liveArena: 'Live Arena', practice: 'Practice', playNow: 'PLAY NOW',
  sessionScores: 'Session Scores', thisVisit: 'This visit',
  connecting: 'Connecting to arena...', joiningRoom: 'Joining room {r}', cancel: 'Cancel', back: 'Back',
  gameOver: 'GAME OVER', finalScore: 'Final Score', playAgain: 'PLAY AGAIN', backToMenu: 'BACK TO MENU',
  betterLuck: 'Better luck next time!',
  deathBump: 'You bumped into another worm.', deathEdge: 'You reached the edge of the arena.',
  pause: 'Pause', resume: 'Resume', mute: 'Mute', unmute: 'Unmute', leaveArena: 'Leave arena',
  expandLb: 'Expand leaderboard', collapseLb: 'Minimize leaderboard',
  solo: 'SOLO', live: 'LIVE', bots: 'BOTS', leader: 'Leader',
  invite: 'Invite', copied: 'Copied', controlsHint: 'WASD / Mouse steer · Left/Right-click or Space to boost',
  you: 'YOU', sizeLeader: 'Size leader:', scoreTag: 'Score', sizeTag: 'Size',
  shop: 'Shop', account: 'Log In', skinTab: 'Skin', hatTab: 'Hat', glassesTab: 'Glasses',
  equipped: 'Equipped', equip: 'Equip', goldNote: 'Score/50 plus arena gold. Gold is rare — earn it.',
  catAll: 'All', catBasit: 'Solid', catCizgili: 'Striped', catDesenli: 'Patterned', catBayraklar: 'Flags',
  guest: 'Guest', guestWithName: 'Play instantly as "{n}"', guestPlain: 'Type a name, play instantly',
  sessionNote: 'scores stay in this session', active: 'Active',
  googleSoon: 'Soon', googleDesc: 'Cloud scores and badges', googleNote: 'When Google login arrives, your scores and shop will live in the cloud.',
  noticeName: 'Use 1-16 letters, numbers, spaces, underscores or hyphens for your name.',
  noticeRoom: 'Room codes use 3-12 uppercase letters or numbers.',
  waitingRespawn: 'Waiting for the server to respawn your worm...',
  respawnRetry: 'Respawn was not confirmed. Please try again.',
  copyManual: 'Copy manually: {v}',
  srvNoResponse: 'Arena server did not respond. Start the Node server or check its address and allowed origins.',
  srvUnreachable: 'Cannot reach the live arena. Check the server address, TLS and allowed origins. Practice mode is still available.',
  connEnded: 'Connection ended. Your temporary session has been removed. Join again for a new ID.',
  connTimeout: 'The connection timed out. Rejoin to start a new session.',
  sessionMismatch: 'Session mismatch.', srvBadData: 'Invalid arena response. The connection was closed for safety.',
  connCancelled: 'Connection cancelled.',
  arenaAddr: 'Use a ws:// or wss:// server address ending in /arena.',
  arenaTls: 'HTTPS pages require a secure wss:// arena server.',
  boostBtn: 'BOOST', arenaAria: 'Wormate arena. Steer with the mouse, arrow keys, WASD, or drag on touch. Hold Space to boost.',
  frenzyCombo: 'SUPER COMBO {n}!', frenzyMult: 'SUPER MULTIPLIER x{n}!', multEnded: 'MULTIPLIER OVER', killNotice: 'KILL!',
  shield: 'SHIELD', bonusSpeed: 'SPEED', bonusCoin: 'GOLD',
  patSolid: 'Solid', patCandy: 'Candy', patFreckles: 'Freckles', patStripes: 'Stripes', patDots: 'Dots',
  flagWord: 'Flag', cTR: 'Turkey', cAZ: 'Azerbaijan', cDE: 'Germany', cFR: 'France', cUS: 'USA', cBR: 'Brazil', cGB: 'UK', cIT: 'Italy',
  hatNone: 'Hatless', hatParty: 'Party Hat', hatBeanie: 'Beanie', hatCowboy: 'Cowboy Hat', hatHelmet: 'Helmet', hatWizard: 'Wizard Hat', hatCrown: 'Crown',
  glNone: 'No glasses', glCool: 'Cool Glasses', glSun: 'Sunglasses', glMono: 'Monocle', glStar: 'Star Glasses', glHeart: 'Heart Glasses',
};

const tr: Texts = {
  docTitle: 'Wormate — Ye. Büyü. Hükmet.',
  nickname: 'Takma Ad', nicknamePh: 'Adını yaz...',
  liveArena: 'Canlı Arena', practice: 'Alıştırma', playNow: 'HEMEN OYNA',
  sessionScores: 'Oturum Skorları', thisVisit: 'Bu ziyaret',
  connecting: 'Arenaya bağlanılıyor...', joiningRoom: '{r} odasına katılınıyor', cancel: 'Vazgeç', back: 'Geri',
  gameOver: 'OYUN BİTTİ', finalScore: 'Son Skor', playAgain: 'TEKRAR OYNA', backToMenu: 'ANA MENÜYE DÖN',
  betterLuck: 'Bir dahaki sefere bol şans!',
  deathBump: 'Başka bir solucana çarptın.', deathEdge: 'Arenanın sınırına ulaştın.',
  pause: 'Duraklat', resume: 'Devam Et', mute: 'Sessiz', unmute: 'Sesi Aç', leaveArena: 'Arenadan ayrıl',
  expandLb: 'Liderliği genişlet', collapseLb: 'Liderliği küçült',
  solo: 'TEK', live: 'CANLI', bots: 'BOTLAR', leader: 'Lider',
  invite: 'Davet', copied: 'Kopyalandı', controlsHint: 'WASD / Fare ile yönlendir · Sol/Sağ tık veya Space ile boost',
  you: 'SEN', sizeLeader: 'Boy lideri:', scoreTag: 'Skor', sizeTag: 'Boy',
  shop: 'Mağaza', account: 'Oturum Aç', skinTab: 'Deri', hatTab: 'Şapka', glassesTab: 'Gözlük',
  equipped: 'Kuşanıldı', equip: 'Kuşan', goldNote: 'Skor/50 + arena altınları. Altın nadirdir, biriktir.',
  catAll: 'Tümü', catBasit: 'Basit', catCizgili: 'Çizgili', catDesenli: 'Desenli', catBayraklar: 'Bayraklar',
  guest: 'Misafir', guestWithName: '"{n}" olarak hemen oyna', guestPlain: 'İsim yaz, hemen oyna',
  sessionNote: 'skorlar bu oturumda saklanır', active: 'Aktif',
  googleSoon: 'Yakında', googleDesc: 'Bulut skorlar ve rozetler', googleNote: 'Google girişi geldiğinde skorların ve mağazan bulutta saklanacak.',
  noticeName: 'Adın 1-16 harf, rakam, boşluk, alt çizgi veya tire olsun.',
  noticeRoom: 'Oda kodları 3-12 büyük harf veya rakam kullanır.',
  waitingRespawn: 'Server solucanını yeniden doğurması bekleniyor...',
  respawnRetry: 'Yeniden doğma onaylanmadı. Lütfen tekrar dene.',
  copyManual: 'Elle kopyala: {v}',
  srvNoResponse: 'Arena serverı yanıt vermedi. Node serverı başlat veya adres ile izinli originleri kontrol et.',
  srvUnreachable: 'Canlı arenaya ulaşılamıyor. Adres, TLS ve izinli originleri kontrol et. Alıştırma modu kullanılabilir.',
  connEnded: 'Bağlantı koptu. Geçici oturumun silindi. Yeni ID için tekrar katıl.',
  connTimeout: 'Bağlantı zaman aşımına uğradı. Yeni oturum için tekrar katıl.',
  sessionMismatch: 'Oturum uyuşmazlığı.', srvBadData: 'Geçersiz arena yanıtı. Bağlantı güvenlik için kapatıldı.',
  connCancelled: 'Bağlantı iptal edildi.',
  arenaAddr: 'ws:// veya wss:// ile biten /arena server adresi kullan.',
  arenaTls: 'HTTPS sayfalar güvenli wss:// arena serverı ister.',
  boostBtn: 'BOOST', arenaAria: 'Wormate arenası. Fare, ok tuşları, WASD veya dokunmatik sürükleme ile yönlendir. Hızlanmak için Space basılı tut.',
  frenzyCombo: 'SÜPER KOMBO {n}!', frenzyMult: 'SÜPER ÇARPAN x{n}!', multEnded: 'ÇARPAN BİTTİ', killNotice: 'AVLADIN!',
  shield: 'KALKAN', bonusSpeed: 'HIZ', bonusCoin: 'ALTIN',
  patSolid: 'Sade', patCandy: 'Şeker', patFreckles: 'Benekli', patStripes: 'Çizgili', patDots: 'Puantiye',
  flagWord: 'Bayrak', cTR: 'Türkiye', cAZ: 'Azerbaycan', cDE: 'Almanya', cFR: 'Fransa', cUS: 'ABD', cBR: 'Brezilya', cGB: 'İngiltere', cIT: 'İtalya',
  hatNone: 'Şapkasız', hatParty: 'Parti Şapkası', hatBeanie: 'Bere', hatCowboy: 'Kovboy Şapkası', hatHelmet: 'Kask', hatWizard: 'Sihirbaz Şapkası', hatCrown: 'Kral Tacı',
  glNone: 'Gözlüksüz', glCool: 'Havalı Gözlük', glSun: 'Güneş Gözlüğü', glMono: 'Monokl', glStar: 'Yıldız Gözlük', glHeart: 'Kalp Gözlük',
};

const es: Texts = {
  docTitle: 'Wormate — Come. Crece. Domina.',
  nickname: 'Apodo', nicknamePh: 'Escribe tu nombre...',
  liveArena: 'Arena en vivo', practice: 'Práctica', playNow: 'JUGAR AHORA',
  sessionScores: 'Puntajes de la sesión', thisVisit: 'Esta visita',
  connecting: 'Conectando a la arena...', joiningRoom: 'Uniéndose a la sala {r}', cancel: 'Cancelar', back: 'Atrás',
  gameOver: 'FIN DEL JUEGO', finalScore: 'Puntuación final', playAgain: 'JUGAR OTRA VEZ', backToMenu: 'VOLVER AL MENÚ',
  betterLuck: '¡Mejor suerte la próxima vez!',
  deathBump: 'Chocaste con otro gusano.', deathEdge: 'Llegaste al borde de la arena.',
  pause: 'Pausa', resume: 'Continuar', mute: 'Silenciar', unmute: 'Activar sonido', leaveArena: 'Salir de la arena',
  expandLb: 'Expandir clasificación', collapseLb: 'Minimizar clasificación',
  solo: 'SOLO', live: 'EN VIVO', bots: 'BOTS', leader: 'Líder',
  invite: 'Invitar', copied: 'Copiado', controlsHint: 'WASD / ratón para dirigir · clic izq/der o Espacio para turbo',
  you: 'TÚ', sizeLeader: 'Líder de tamaño:', scoreTag: 'Puntos', sizeTag: 'Tamaño',
  shop: 'Tienda', account: 'Iniciar sesión', skinTab: 'Piel', hatTab: 'Sombrero', glassesTab: 'Gafas',
  equipped: 'Equipado', equip: 'Equipar', goldNote: 'Puntos/50 más el oro de la arena. El oro es raro.',
  catAll: 'Todo', catBasit: 'Sólido', catCizgili: 'Rayado', catDesenli: 'Estampado', catBayraklar: 'Banderas',
  guest: 'Invitado', guestWithName: 'Juega al instante como "{n}"', guestPlain: 'Escribe un nombre, juega al instante',
  sessionNote: 'los puntos se quedan en esta sesión', active: 'Activo',
  googleSoon: 'Pronto', googleDesc: 'Puntos e insignias en la nube', googleNote: 'Cuando llegue Google, tus puntos y tienda vivirán en la nube.',
  noticeName: 'Usa 1-16 letras, números, espacios, guiones bajos o guiones para tu nombre.',
  noticeRoom: 'Los códigos de sala usan 3-12 letras mayúsculas o números.',
  waitingRespawn: 'Esperando que el servidor reaparezca tu gusano...',
  respawnRetry: 'La reaparición no se confirmó. Inténtalo de nuevo.',
  copyManual: 'Copia manualmente: {v}',
  srvNoResponse: 'El servidor no respondió. Inicia el servidor Node o revisa su dirección y orígenes.',
  srvUnreachable: 'No se puede llegar a la arena. Revisa dirección, TLS y orígenes. El modo práctica sigue disponible.',
  connEnded: 'Conexión terminada. Tu sesión temporal se eliminó. Únete de nuevo para un nuevo ID.',
  connTimeout: 'La conexión expiró. Únete de nuevo para una nueva sesión.',
  sessionMismatch: 'Sesión no coincide.', srvBadData: 'Respuesta inválida. La conexión se cerró por seguridad.',
  connCancelled: 'Conexión cancelada.',
  arenaAddr: 'Usa una dirección ws:// o wss:// que termine en /arena.',
  arenaTls: 'Las páginas HTTPS requieren un servidor wss:// seguro.',
  boostBtn: 'TURBO', arenaAria: 'Arena Wormate. Dirige con el ratón, flechas, WASD o arrastra en táctil. Mantén Espacio para turbo.',
  frenzyCombo: '¡SUPERCOMBO {n}!', frenzyMult: '¡SUPER MULTIPLICADOR x{n}!', multEnded: 'MULTIPLICADOR TERMINADO', killNotice: '¡CAZADO!',
  shield: 'ESCUDO', bonusSpeed: 'VELOCIDAD', bonusCoin: 'ORO',
  patSolid: 'Sólido', patCandy: 'Caramelo', patFreckles: 'Pecas', patStripes: 'Rayas', patDots: 'Puntos',
  flagWord: 'Bandera', cTR: 'Turquía', cAZ: 'Azerbaiyán', cDE: 'Alemania', cFR: 'Francia', cUS: 'EE. UU.', cBR: 'Brasil', cGB: 'Reino Unido', cIT: 'Italia',
  hatNone: 'Sin sombrero', hatParty: 'Gorro de fiesta', hatBeanie: 'Gorro', hatCowboy: 'Sombrero de vaquero', hatHelmet: 'Casco', hatWizard: 'Sombrero de mago', hatCrown: 'Corona',
  glNone: 'Sin gafas', glCool: 'Gafas geniales', glSun: 'Gafas de sol', glMono: 'Monóculo', glStar: 'Gafas de estrella', glHeart: 'Gafas de corazón',
};

const fr: Texts = {
  docTitle: 'Wormate — Mange. Grandis. Domine.',
  nickname: 'Pseudo', nicknamePh: 'Entrez votre nom...',
  liveArena: 'Arène en direct', practice: 'Entraînement', playNow: 'JOUER',
  sessionScores: 'Scores de la session', thisVisit: 'Cette visite',
  connecting: "Connexion à l'arène...", joiningRoom: 'Connexion à la salle {r}', cancel: 'Annuler', back: 'Retour',
  gameOver: 'PARTIE TERMINÉE', finalScore: 'Score final', playAgain: 'REJOUER', backToMenu: 'RETOUR AU MENU',
  betterLuck: 'Meilleure chance la prochaine fois !',
  deathBump: "Tu as percuté un autre ver.", deathEdge: "Tu as atteint le bord de l'arène.",
  pause: 'Pause', resume: 'Reprendre', mute: 'Muet', unmute: 'Activer le son', leaveArena: "Quitter l'arène",
  expandLb: 'Agrandir le classement', collapseLb: 'Réduire le classement',
  solo: 'SOLO', live: 'EN DIRECT', bots: 'BOTS', leader: 'Leader',
  invite: 'Inviter', copied: 'Copié', controlsHint: 'ZQSD / souris pour diriger · clic gauche/droit ou Espace pour turbo',
  you: 'TOI', sizeLeader: 'Menant par la taille :', scoreTag: 'Score', sizeTag: 'Taille',
  shop: 'Boutique', account: 'Connexion', skinTab: 'Peau', hatTab: 'Chapeau', glassesTab: 'Lunettes',
  equipped: 'Équipé', equip: 'Équiper', goldNote: "Score/50 plus l'or de l'arène. L'or est rare.",
  catAll: 'Tout', catBasit: 'Uni', catCizgili: 'Rayé', catDesenli: 'À motifs', catBayraklar: 'Drapeaux',
  guest: 'Invité', guestWithName: 'Joue aussitôt en tant que « {n} »', guestPlain: 'Écris un nom, joue aussitôt',
  sessionNote: 'les scores restent dans cette session', active: 'Actif',
  googleSoon: 'Bientôt', googleDesc: 'Scores et badges dans le cloud', googleNote: "Avec Google, tes scores et ta boutique vivront dans le cloud.",
  noticeName: 'Utilise 1-16 lettres, chiffres, espaces, traits de soulignement ou tirets pour ton nom.',
  noticeRoom: 'Les codes de salle utilisent 3-12 lettres majuscules ou chiffres.',
  waitingRespawn: 'En attente de réapparition par le serveur...',
  respawnRetry: 'Réapparition non confirmée. Réessaie.',
  copyManual: 'Copie manuellement : {v}',
  srvNoResponse: "Le serveur n'a pas répondu. Démarre le serveur Node ou vérifie son adresse et origines.",
  srvUnreachable: "Arène injoignable. Vérifie l'adresse, TLS et origines. Le mode entraînement reste disponible.",
  connEnded: 'Connexion terminée. Ta session temporaire a été supprimée. Rejoins pour un nouvel ID.',
  connTimeout: 'Connexion expirée. Rejoins pour une nouvelle session.',
  sessionMismatch: 'Session incohérente.', srvBadData: 'Réponse invalide. Connexion fermée par sécurité.',
  connCancelled: 'Connexion annulée.',
  arenaAddr: 'Utilise une adresse ws:// ou wss:// se terminant par /arena.',
  arenaTls: 'Les pages HTTPS exigent un serveur wss:// sécurisé.',
  boostBtn: 'TURBO', arenaAria: "Arène Wormate. Dirige à la souris, flèches, ZQSD ou glisser tactile. Maintiens Espace pour le turbo.",
  frenzyCombo: 'SUPER COMBO {n} !', frenzyMult: 'SUPER MULTIPLICATEUR x{n} !', multEnded: 'MULTIPLICATEUR TERMINÉ', killNotice: 'CHASSÉ !',
  shield: 'BOUCLIER', bonusSpeed: 'VITESSE', bonusCoin: 'OR',
  patSolid: 'Uni', patCandy: 'Bonbon', patFreckles: 'Taches', patStripes: 'Rayures', patDots: 'Pois',
  flagWord: 'Drapeau', cTR: 'Turquie', cAZ: 'Azerbaïdjan', cDE: 'Allemagne', cFR: 'France', cUS: 'USA', cBR: 'Brésil', cGB: 'Royaume-Uni', cIT: 'Italie',
  hatNone: 'Sans chapeau', hatParty: 'Chapeau de fête', hatBeanie: 'Bonnet', hatCowboy: 'Chapeau de cowboy', hatHelmet: 'Casque', hatWizard: 'Chapeau de magicien', hatCrown: 'Couronne',
  glNone: 'Sans lunettes', glCool: 'Lunettes cool', glSun: 'Lunettes de soleil', glMono: 'Monocle', glStar: 'Lunettes étoile', glHeart: 'Lunettes cœur',
};

const de: Texts = {
  docTitle: 'Wormate — Friss. Wachse. Herrsche.',
  nickname: 'Spitzname', nicknamePh: 'Namen eingeben...',
  liveArena: 'Live-Arena', practice: 'Training', playNow: 'JETZT SPIELEN',
  sessionScores: 'Sitzungspunkte', thisVisit: 'Dieser Besuch',
  connecting: 'Verbinde mit der Arena...', joiningRoom: 'Trete Raum {r} bei', cancel: 'Abbrechen', back: 'Zurück',
  gameOver: 'SPIEL VORBEI', finalScore: 'Endpunktzahl', playAgain: 'NOCHMAL SPIELEN', backToMenu: 'ZURÜCK ZUM MENÜ',
  betterLuck: 'Viel Glück beim nächsten Mal!',
  deathBump: 'Du bist mit einem anderen Wurm zusammengestoßen.', deathEdge: 'Du hast den Arenarand erreicht.',
  pause: 'Pause', resume: 'Fortsetzen', mute: 'Stumm', unmute: 'Ton an', leaveArena: 'Arena verlassen',
  expandLb: 'Bestenliste erweitern', collapseLb: 'Bestenliste minimieren',
  solo: 'SOLO', live: 'LIVE', bots: 'BOTS', leader: 'Anführer',
  invite: 'Einladen', copied: 'Kopiert', controlsHint: 'WASD / Maus zum Steuern · Links-/Rechtsklick oder Leertaste für Boost',
  you: 'DU', sizeLeader: 'Größenanführer:', scoreTag: 'Punkte', sizeTag: 'Größe',
  shop: 'Shop', account: 'Anmelden', skinTab: 'Haut', hatTab: 'Hut', glassesTab: 'Brille',
  equipped: 'Ausgerüstet', equip: 'Ausrüsten', goldNote: 'Punkte/50 plus Arena-Gold. Gold ist selten.',
  catAll: 'Alle', catBasit: 'Einfarbig', catCizgili: 'Gestreift', catDesenli: 'Gemustert', catBayraklar: 'Flaggen',
  guest: 'Gast', guestWithName: 'Spiele sofort als „{n}“', guestPlain: 'Namen tippen, sofort spielen',
  sessionNote: 'Punkte bleiben in dieser Sitzung', active: 'Aktiv',
  googleSoon: 'Bald', googleDesc: 'Cloud-Punkte und Abzeichen', googleNote: 'Mit Google leben deine Punkte und dein Shop in der Cloud.',
  noticeName: 'Nutze 1-16 Buchstaben, Zahlen, Leerzeichen, Unterstriche oder Bindestriche für deinen Namen.',
  noticeRoom: 'Raumcodes nutzen 3-12 Großbuchstaben oder Zahlen.',
  waitingRespawn: 'Warte auf Respawn durch den Server...',
  respawnRetry: 'Respawn nicht bestätigt. Bitte erneut versuchen.',
  copyManual: 'Manuell kopieren: {v}',
  srvNoResponse: 'Der Server antwortet nicht. Starte den Node-Server oder prüfe Adresse und Origins.',
  srvUnreachable: 'Arena nicht erreichbar. Prüfe Adresse, TLS und Origins. Training bleibt verfügbar.',
  connEnded: 'Verbindung beendet. Deine temporäre Sitzung wurde gelöscht. Tritt für eine neue ID erneut bei.',
  connTimeout: 'Zeitüberschreitung. Tritt für eine neue Sitzung erneut bei.',
  sessionMismatch: 'Sitzungskonflikt.', srvBadData: 'Ungültige Antwort. Verbindung aus Sicherheit geschlossen.',
  connCancelled: 'Verbindung abgebrochen.',
  arenaAddr: 'Nutze eine ws://- oder wss://-Adresse, die auf /arena endet.',
  arenaTls: 'HTTPS-Seiten brauchen einen sicheren wss://-Server.',
  boostBtn: 'BOOST', arenaAria: 'Wormate-Arena. Steuern mit Maus, Pfeilen, WASD oder Touch-Drag. Leertaste halten für Boost.',
  frenzyCombo: 'SUPER-KOMBO {n}!', frenzyMult: 'SUPER-MULTI x{n}!', multEnded: 'MULTI VORBEI', killNotice: 'ERLEGT!',
  shield: 'SCHILD', bonusSpeed: 'SPEED', bonusCoin: 'GOLD',
  patSolid: 'Einfarbig', patCandy: 'Candy', patFreckles: 'Sommersprossen', patStripes: 'Streifen', patDots: 'Punkte',
  flagWord: 'Flagge', cTR: 'Türkei', cAZ: 'Aserbaidschan', cDE: 'Deutschland', cFR: 'Frankreich', cUS: 'USA', cBR: 'Brasilien', cGB: 'Großbritannien', cIT: 'Italien',
  hatNone: 'Ohne Hut', hatParty: 'Partyhut', hatBeanie: 'Mütze', hatCowboy: 'Cowboyhut', hatHelmet: 'Helm', hatWizard: 'Zauberhut', hatCrown: 'Krone',
  glNone: 'Ohne Brille', glCool: 'Coole Brille', glSun: 'Sonnenbrille', glMono: 'Monokel', glStar: 'Sternbrille', glHeart: 'Herzbrille',
};

const pt: Texts = {
  docTitle: 'Wormate — Come. Cresça. Domine.',
  nickname: 'Apelido', nicknamePh: 'Digite seu nome...',
  liveArena: 'Arena ao vivo', practice: 'Treino', playNow: 'JOGAR AGORA',
  sessionScores: 'Pontos da sessão', thisVisit: 'Esta visita',
  connecting: 'Conectando à arena...', joiningRoom: 'Entrando na sala {r}', cancel: 'Cancelar', back: 'Voltar',
  gameOver: 'FIM DE JOGO', finalScore: 'Pontuação final', playAgain: 'JOGAR DE NOVO', backToMenu: 'VOLTAR AO MENU',
  betterLuck: 'Mais sorte na próxima vez!',
  deathBump: 'Você bateu em outra minhoca.', deathEdge: 'Você chegou à borda da arena.',
  pause: 'Pausar', resume: 'Continuar', mute: 'Mudo', unmute: 'Ativar som', leaveArena: 'Sair da arena',
  expandLb: 'Expandir classificação', collapseLb: 'Minimizar classificação',
  solo: 'SOLO', live: 'AO VIVO', bots: 'BOTS', leader: 'Líder',
  invite: 'Convidar', copied: 'Copiado', controlsHint: 'WASD / mouse para dirigir · botão esq/dir ou Espaço para turbo',
  you: 'VOCÊ', sizeLeader: 'Líder de tamanho:', scoreTag: 'Pontos', sizeTag: 'Tamanho',
  shop: 'Loja', account: 'Entrar', skinTab: 'Pele', hatTab: 'Chapéu', glassesTab: 'Óculos',
  equipped: 'Equipado', equip: 'Equipar', goldNote: 'Pontos/50 mais o ouro da arena. Ouro é raro.',
  catAll: 'Tudo', catBasit: 'Sólido', catCizgili: 'Listrado', catDesenli: 'Estampado', catBayraklar: 'Bandeiras',
  guest: 'Convidado', guestWithName: 'Jogue na hora como "{n}"', guestPlain: 'Digite um nome, jogue na hora',
  sessionNote: 'pontos ficam nesta sessão', active: 'Ativo',
  googleSoon: 'Em breve', googleDesc: 'Pontos e emblemas na nuvem', googleNote: 'Com o Google, seus pontos e loja viverão na nuvem.',
  noticeName: 'Use 1-16 letras, números, espaços, sublinhados ou hifens no seu nome.',
  noticeRoom: 'Códigos de sala usam 3-12 letras maiúsculas ou números.',
  waitingRespawn: 'Aguardando o servidor renascer sua minhoca...',
  respawnRetry: 'Renascimento não confirmado. Tente de novo.',
  copyManual: 'Copie manualmente: {v}',
  srvNoResponse: 'O servidor não respondeu. Inicie o servidor Node ou verifique endereço e origens.',
  srvUnreachable: 'Arena inalcançável. Verifique endereço, TLS e origens. O treino continua disponível.',
  connEnded: 'Conexão encerrada. Sua sessão temporária foi removida. Entre de novo para um novo ID.',
  connTimeout: 'Tempo esgotado. Entre de novo para uma nova sessão.',
  sessionMismatch: 'Sessão incompatível.', srvBadData: 'Resposta inválida. Conexão fechada por segurança.',
  connCancelled: 'Conexão cancelada.',
  arenaAddr: 'Use um endereço ws:// ou wss:// terminado em /arena.',
  arenaTls: 'Páginas HTTPS exigem um servidor wss:// seguro.',
  boostBtn: 'TURBO', arenaAria: 'Arena Wormate. Dirija com mouse, setas, WASD ou arraste no toque. Segure Espaço para turbo.',
  frenzyCombo: 'SUPERCOMBO {n}!', frenzyMult: 'SUPER MULTIPLICADOR x{n}!', multEnded: 'MULTIPLICADOR ACABOU', killNotice: 'CAÇADO!',
  shield: 'ESCUDO', bonusSpeed: 'VELOCIDADE', bonusCoin: 'OURO',
  patSolid: 'Sólido', patCandy: 'Doce', patFreckles: 'Sardas', patStripes: 'Listras', patDots: 'Bolinhas',
  flagWord: 'Bandeira', cTR: 'Turquia', cAZ: 'Azerbaijão', cDE: 'Alemanha', cFR: 'França', cUS: 'EUA', cBR: 'Brasil', cGB: 'Reino Unido', cIT: 'Itália',
  hatNone: 'Sem chapéu', hatParty: 'Chapéu de festa', hatBeanie: 'Gorro', hatCowboy: 'Chapéu de caubói', hatHelmet: 'Capacete', hatWizard: 'Chapéu de mago', hatCrown: 'Coroa',
  glNone: 'Sem óculos', glCool: 'Óculos descolados', glSun: 'Óculos de sol', glMono: 'Monóculo', glStar: 'Óculos estrela', glHeart: 'Óculos coração',
};

export const STRINGS: Record<Lang, Texts> = { tr, en, es, fr, de, pt };

export const lang: Lang = detectLang();
export const t: Texts = STRINGS[lang];

// Bonus küpü üstündeki kısa kod: hız çevrilir, çarpanlar sayısal, CHOMP evrensel ses sözcüğüdür.
export function bonusLabel(kind: BonusKind): string {
  if (kind === 'speed') return t.bonusSpeed;
  if (kind === 'chomp') return 'CHOMP';
  if (kind === 'coin') return t.bonusCoin;
  return kind;
}
