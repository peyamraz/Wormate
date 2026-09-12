# WORMATE — Proje Hafızası

> Kaynak: `https://github.com/peyamraz/Wormate`, dal: `main` (en güncel, PR #7 + #8 merge'li).
> Yerel eski kopya (`sessionManager/BroadcastChannel` sahte-multiplayer) silindi, yerine `main` temiz klonlandı.
> Repo public kalacak. İsim şimdilik **Wormate** (değişiklik yok).
> Yeniden adlandırma gündeme gelirse öne çıkan aday: **Wurmix** (yedek: HexWorm, Wriggle).
> Elenenler: Slitherhex (slither.io çakışması), Devour.io (mevcut korku oyunu).

## Mimari (mevcut)

- **Client:** React 19 + Vite 7 + Tailwind 4, `src/`:
  - `gameEngine.ts` — tek tick motor (local + online). `Worm`, `GameEngine`, `getCameraZoom`, grid (`GRID 160px 20x20`).
  - `gameRenderer.ts` + `gameArt.ts` — canvas render, treat/bonus/worm sprite'ları (bake-once, blit).
  - `GameCanvas.tsx` — fixed timestep (`STEP 1000/60`, `MAX_CATCHUP`), pointer + klavye + mobil boost düğmesi.
  - `App.tsx` — menu / connecting / playing / paused / gameover, skor + liderlik HUD.
  - `network/OnlineClient.ts` — WS client, input 32ms throttle, snapshot interp (`stepView`).
  - `network/protocol.ts` + `validation.ts` — strict şema (`exactKeys`, 1KB inbound cap).
  - `session.ts` — misafir oturumu, sadece hafızada (cookie/localStorage yok).
  - `constants.ts` — arena 3200x320, solucan start 28 / max 280 segment, `GROWTH_PER_FOOD 2`, kamera `START_ZOOM 2 / MIN 0.82`.
- **Server:** Node + `ws`, `server/arenaServer.ts` — 60Hz authoritative sim, 4 oda x 16 kişi, snapshot 4 tick'te bir (~15Hz), interest filtering (görünür alan), TokenBucket rate-limit, origin allowlist, heartbeat, CSP/health.
- **Test:** `server/*.test.ts` (protokol, oda izolasyonu, skor, çarpışma, bonus süresi, sahte skor/ID reddi).
- **Deploy:** `npm start` → `server/start.js` → build + arena server; Caddy + Railway notları `MULTIPLAYER.md`'de.

## Bilinen sorun (kullanıcı geri bildirimi)

- Puan artıyor ama **yılan büyümesi hissedilmiyor** — kamera zoom-out (`growth^0.38`) boy farkını maskeliyor, radius büyümesi (`^0.34`, cap 2.1x) zayıf.
- Liderlik tek eksen (skor). **Boy/hacim rekabeti yok** — herkes birinci olmak istiyor: hem puan hem hacim görünmeli.

## Geliştirme sırası (onaylı roadmap)

1. **Rekabet (TAMAM — 2026-09-12):** kamera zoom üssü `0.38→0.26` (dev solucan ekranda dev görünür, testle sabitlendi).
   Liderlik çift eksen: her satırda skor + boy, 👑 skor lideri + 🐉 boy lideri rozeti, farklıysa alt satırda boy lideri,
   footer'da `Skor #n · Boy #m`. `PlayerStatus.size/sizeRank`, `LeaderboardEntry.size`; validasyon güncellendi.
   Test: 25/25 geçti (`tsc` temiz, `vite build` OK).
2. **Mağaza (TAMAM — 2026-09-12):** `src/shop.ts` katalog + cüzdan (`wormate_coins`, kazanım skor/10; `wormate_owned`, `wormate_loadout`).
   ~44 deri (12 sade + 24 desenli `candy/freckles/stripes/dots` + 8 bayrak), 7 şapka, 6 gözlük.
   Kozmetik `style` mesajıyla server'a taşınır (doğrulanır: renk allowlist, desen/şapka/gözlük ID), snapshot'ta herkese yayınlanır, `drawFace` şapka+gözlük çizer.
   Test: 23/23 geçti (`tsc` temiz, `vite build` OK). Bilinen sınır: yeni desen boyası eklendi; kafa deseni düzeltildi.
3. **Skor kaydetme (TAMAM — 2026-09-12, Google ERTELENDİ):** Firebase yok, üyelik yok.
   Skor listesi SADECE oturumluk (memory): sekmeye her gelişte boş başlar, oyun içinde birikir.
   Eski `wormate_highscores` anahtarı bir kez silinir. Kalıcı olan tek şey mağaza cüzdanı + envanter.
4. **Süper toplama efekti (TAMAM — 2026-09-12):** client katmanında (`GameCanvas`), practice + online uyumlu, protokol değişikliği yok.
   Kombo 8/12/16/20'ye ulaşınca: altın halka + `SÜPER KOMBO n!` yazısı + şenlik parçacıkları + sarsıntı + yükselen `frenzy()` sesi.
   Çarpan x5+ seviyeye ilk geçişte: `SÜPER ÇARPAN xn!` + patlama. Respawn'da sayaçlar sıfırlanır.
   Test: 26/26 geçti (`tsc` temiz, `vite build` OK).
5. **Hız sistemi (TAMAM — 2026-09-12):** PC'de **sol + sağ tık basılı = boost** (diğer tuş basılıyken bırakma boost'u kesmez),
   mobil BOOST düğmesinde dokunsal titreşim. Hız bonusu aktifken kuyruktan mavi iz çıkar.
   Test: 27/27 geçti (`tsc` temiz, `vite build` OK).
6. **Çarpan netliği (TAMAM — 2026-09-12):** rozet son 3 saniyede nabız gibi atar, bitişte `ÇARPAN BİTTİ` yazısı + düşen ses.
   Yüzen yazılar artık değersiz `+0` basmaz (sadece etiket modu eklendi). Çarpan zaten her lokmaya uygulanıyordu, testle sabitlendi.
7. **Hızlı toplama efekti (TAMAM — 2026-09-12):** CHOMP ile yeme tok `gulp`, SPEED ile tiz `zip` sesi;
   SPEED aktifken kafada kesik mavi halka + mavi kuyruk izi (CHOMP turuncu halkası zaten vardı).
   Test: 28/28 geçti (`tsc` temiz, `vite build` OK).

## Ek işler (2026-09-12)

- **Otomatik dil (6 dil, seçici yok):** `src/i18n.ts` — tarayıcı dilinden tr/en/es/fr/de/pt, bilinmeyene en.
  Menü/HUD/mağaza/oturum/hata/ölüm/frenzy metinleri + sekme başlığı + `<html lang>` çevrildi.
  Kapsam dışı (sonra): mağaza ürün adları, bonus rozet kodları (SPEED/CHOMP), canvas kafa etiketi kısmi.
  Test: 31/31 geçti (`tsc` temiz, `vite build` OK).

- **i18n 2. tur (TAMAM):** ürün adları sözlükten (`skinName/hatName/glassesName`), bonus küpü etiketi
  (`HIZ/SPEED/VELOCIDAD/VITESSE/SPEED/VELOCIDADE`, CHOMP evrensel), kafa `SHIELD→KALKAN…`.
  practice bonus yazısı da çevrildi. Test: 32/32 (`tsc` temiz, build OK).

- **Büyük dünya:** arena 3200→4000, grid 25x25, spawn merkeze göre, yemek 1500/bonus 18/bot 18 (online 8).
- **Duvar dışı void + mini harita:** dış alan desensiz karanlık, sınır ince çizgi; sol üstte konum/bonus/bot haritası + görüş çerçevesi.
- **Arena akıcılık:** snapshot 15→20Hz, paket başı yemek 500 cap (donma şikayetine karşı).
- Test: 29/29 geçti (`tsc` temiz, `vite build` OK).

- **Kozmetik denetimi (TAMAM):** `server/cosmetics.test.ts` — 44 deri + 7 şapka + 6 gözlük +
  bonus/yemek sprite'ları tek tek geometrik kontrolden geçer (simetri, ağız açıklığı, lens konumu).
  Bulunan gerçek hata: taç yana kayıktı → simetrik zikzak banda çevrildi. Desenler belirginleştirildi.
- Test: 36/36 (`tsc` temiz, build OK).

- **Dairesel arena (TAMAM):** sınır artık R=2000 çember; zemin iç/dış dikişsiz aynı desen,
  ince dairesel çizgi + kenara yaklaşınca kırmızı nabız uyarısı + mini haritada çember.
  Spawn/yem/bonus/bot daire içine kelepçelenir, validasyon radyal. Ölüm mekaniği aynı.
- Test: 37/37 (`tsc` temiz, build OK).

- **Gerçek bayraklar + overlay mağaza (TAMAM):** 8 ülke gerçek deseniyle boyanır
  (TR hilal+yıldız, AZ hilalli şerit, US yıldızlı kanton, BR eşkenar+paralel, GB haçlar, DE/FR/IT bantlar).
  Önizleme artık renk noktası değil oyundaki sprite'ın ta kendisi (`SkinPreview`).
  Mağaza öne çıkan tam ekran sayfa (kategoriler veri güdümlü, ekleme tek yerden).
- Test: 37/37 (`tsc` temiz, build OK).

- **Büyük arena 2 (TAMAM):** R 2000→2600 (dünya 5200, grid 33x33), yemek 2400/bonus 24/odada 10 bot.
  Uçtan uca yürüyüş ~30sn→~40sn. Test: 37/37 (`tsc` temiz, build OK).

- **CHOMP cızırtısı (TAMAM):** `gulp` kare→üçgen dalga + 120ms seyretme, `zip` de seyretmeli,
  CHOMP pickup sesi yumuşatıldı. `tsc` temiz, build OK.

- **Kenar alarmı (TAMAM):** 420px kala çemberin ekrandaki kısmı hafif kırmızı parlar
  (geniş silik bant + ince çizgi, yaklaştıkça opaklaşır). Kafa işareti ve bip yok.

- **İri bonus küpleri (TAMAM):** gövde 42→56, çarpanlar 62-68 + geniş hale + nabız halkası.
  Mıknatıs dahil tüm küpler uzaktan fark edilir. `tsc` temiz, build OK.

- **Altın ekonomisi (TAMAM):** skor→altın /10→/50 (5 kat zorlaştı) + arenada nadir ALTIN küpü
  (+10 altın, süreli efekt yok, 6 dilde etiketli). Cüzdan iki kaynaktan beslenir.
  Örnek: 2000 skor + 4 altın ≈ 80 altın/oyun; taç (1000) ~12 oyun. Test: 38/38 (`tsc` temiz, build OK).

- **Düz boru gövde (TAMAM):** bombeli dilimler gitti; tek renk tüp zemini + yassı desen diski.
  Desen ve bayrak artık kesintisiz okunur. Önizleme de aynı sprite. Test: 37/37 (`tsc` temiz, build OK).

- **Vücut ritmi (TAMAM):** çizgi/bayrak dilim başına değil gövde boyunca dizilir —
  çizgili halka halka, bayraklar bant + 12 dilimde bir amblem (hilal/yıldız/güneş/haç).
  Kafa amblemi taşır, önizleme ritmi gösterir. Test: 39/39 (`tsc` temiz, build OK).

- **Rakip deri düzeni (TAMAM):** bantlar her dilimde alterne (rakip halkalar gibi sık ritim),
  deri sayfasında Basit/Çizgili/Desenli/Bayraklar filtre çipleri (6 dilde). Test: 39/39 (`tsc` temiz, build OK).

- **Bağlantı kopma teşhisi (TAMAM):** kopma mesajı artık soket kodunu gösterir (`[#1006]` gibi);
  heartbeat 10→15sn (mobilde haksız atılma azalır). Test: 37/37 (`tsc` temiz, build OK).

## Rakip analizi + yapılacaklar (tüm ekran görüntülerinden, 2026-09-12)

Kaynak: wormate.io orijinali (Deriler/Giyim/Madeni paralar, ölüm patlaması, minimap+Top10,
profil/seviye, yem çeşitliliği, korsan şapka+göz bandı takan solucanlar).
- Faz 1 (TAMAM — 2026-09-12): ölüm jackpot'u — 2 segmentte 1 loot + hazine, katile +150
  skor + AVLADIN bildirimi + sesi, %100 altın düşer. Minimap artı çizgisi. Test: 41/41 (`tsc` temiz, build OK).
- Ölüm patlaması (TAMAM): beyaz flaş + şok halkası + iri ganimet (kurban iriliğine göre).
  Practice + online. Test: 48/48 (`tsc` temiz, build OK).
- DEV bonusu (İPTAL — kullanıcı isteği): büyüme silindi, yerine WIDE kamera bonusu.
  Yiyen devleşmez; kamera %30 açılır, süre bitince yumuşakça daralır. Mor rozet + 6 dilde
  etiket (WIDE/GENİŞ…), online senkronlu. Test: 51/51 (`tsc` temiz, build OK).
- Orantılı büyüme (TAMAM): lokma kuyruğa yazılır (tick başına 1 segment), DEV şişmesi
  blend ile yumuşar, kamera/dev senkronlu. Test: 51/51 (`tsc` temiz, build OK).
- Faz 2 (TAMAM — 2026-09-12): Giyim — 4 göz + 3 ağız stili, altınla, online senkronlu
  (style mesajı + snapshot + validasyon). Test: 42/42 (`tsc` temiz, build OK).
- Faz 3 (TAMAM — 2026-09-12): Seviye/XP — toplam skordan üçgensel eşik, menüde profil
  + XP barı, atlayınca kutlama + 25×seviye altın. Test: 44/44 (`tsc` temiz, build OK).
- Faz 2: Giyim sekmesi — göz stilleri + ağız stilleri (sadece drawFace, altınla, protokol yok).
- Faz 3: Seviye/XP — toplam skordan seviye, menüde rozet + bar.
- Faz 4 (TAMAM — 2026-09-12): 5 yeni tatlı — karpuz, zencefilli kurabiye adam, böğürtlen,
  portakal, kruvasan (9→14 çeşit). Değer dengesi korunur, validasyon otomatik.
  Test: 44/44 (`tsc` temiz, build OK).
- Büyüme tavanları (TAMAM): boy 280→900, kalınlık 3.2x, skora bağlı logaritmik hacim
  (1M skor ≈ +1.75x). Yenidoğan karınca, dev fil. Bonus sıklığı normale (14/20).
  Test: 45/45 (`tsc` temiz, build OK).
- Snapshot diyeti + validasyon tavanları (TAMAM): 600+ segment seyreltilir, yarıçap
  sınırı 40→100. Test: 47/47 (`tsc` temiz, build OK).
- Kill kopuşu (TAMAM): kill olayı `#ff5d5d` rengi allowlist dışındaydı → avlanan
  oyuncu anında kopuyordu. Renk `#fb7185`, motor+paket testiyle kilitlendi.
  Test: 47/47 (`tsc` temiz, build OK). NOT: server deploy şart!
- Bonus dağılımı (TAMAM): doğumda 350px ayrıklık kuralı, hız/chomp ağırlığı düşürüldü,
  başlangıç küpleri dağıtıldı. Test: 46/46 (`tsc` temiz, build OK).
- HARİÇ: gerçek parayla coin (Madeni paralar IAP) — web hobby'de yok. İsim Wormate kalıyor.

## Kararlar / notlar

- Ölçek: şu an küçük ölçek — oda kapasitesi (16→20) ve process sharding (5000 kişi senaryosu) ERTELENDİ.
  Daire büyütme (R 2600) de aynı sebeple bekliyor; oyuncu sayısı artınca yoğunlukla birlikte ele alınacak.

- Para modeli (varsayılan): **skor = altın**, her oyun sonu cüzdana eklenir. Değişirse buraya işle.
- Protokol değişirse (`LeaderboardEntry` +boy, cüzdan, kuşanan eşya) client+server aynı repoda birlikte bump edilir.
- Son doğrulama: `npx tsc --noEmit` + `node --import tsx --test server/*.test.ts` + 2 sekmeli oda testi.
