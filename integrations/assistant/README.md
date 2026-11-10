# assistant — AI asistan sohbet katmanı (KaplanBIM)

Bu paket, kullanıcının doğal dilde sorduğu bir soruyu sınıflandırıp doğru arka
uca yönlendiren **küçük, test edilebilir bir yönlendirme katmanıdır**. Task 2.4'ün
çıktısıdır; Task 2.3'ün ürettiği ERP köprüsünü tüketir.

## Ne yapar

`Assistant.answer(question)` şu akışı izler:

1. `classifyQuestion(question)` soruyu `"bim" | "erp" | "unknown"` olarak
   sınıflandırır (saf, deterministik; anahtar kelime tabanlı bir sezgisel).
2. Sınıfa göre arka ucu çağırır ve yapılandırılmış bir `AssistantReply`
   (`{ route, text, data? }`) döner.

| Soru örneği | Sınıf | Arka uç |
| --- | --- | --- |
| "3. kattaki havalandırma kanalı metrajı ne?" | `bim` | KaplanBIM MCP |
| "bu kalem neden bütçeyi aştı?" | `erp` | ERP köprüsü |
| "bugün hava nasıl?" | `unknown` | hiçbiri |

`classifyQuestion` saf bir fonksiyondur: model/geometri/metraj kelimeleri
(`metraj`, `miktar`, `model`, `kanal`, `havalandırma`, …) → `bim`;
maliyet/BOQ/bütçe kelimeleri (`bütçe`, `maliyet`, `fiyat`, `kalem`, `boq`,
`budget`, `cost`, …) → `erp`. İki kümeye de uyan soru `unknown` döner (belirsiz
durumda yanlış arka uca sessizce gitmektense net sinyal verilir).

## İki arka uç bağımlılığı

1. **KaplanBIM MCP** — model/geometri/metraj soruları için. Kodda `ModelMcp`
   arayüzüyle temsil edilir (`queryModel(question): Promise<string>`).
   Gerçekte bu, KaplanBIM'in **script-first, ≤10 çekirdek araç** paketine
   gider (ajan bir script yazar → kontrol eder → uygular). Bu katman canlı MCP
   çağrısını **temsil eder**, taklit etmez: MCP enjekte edilmemişse açıkça
   "bağlı değil" der.
2. **ERP köprüsü** — maliyet/BOQ/bütçe soruları için. Kodda `ErpBridge`
   arayüzüyle temsil edilir; `Boq`/`CostItem` tipleri
   `../../erp-bridge/src/queries.js`'den alınır.

Her iki bağımlılık da **enjekte edilebilir** (Task 2.3'teki yaklaşımla
tutarlı): `new Assistant({ erp, mcp? }, options?)`. Birim testler canlı MCP
veya canlı ERP olmadan çalışır.

### Varsayılan kurulum (`createDefaultAssistant`)

Kutudan çıktığı gibi ERP'yi sorgulayabilmesi için varsayılan bir fabrika
vardır: `createDefaultAssistant(options?)`. Bu fabrika `ErpBridge`'i Task 2.3'ün
**gerçek** `queryBoq` / `queryCostItem` fonksiyonlarına bağlar; o fonksiyonlar
da istemciyi `createErpClientFromEnv()` ile ortam değişkenlerinden
(`ERP_BASE_URL`, `ERP_ACCESS_TOKEN`) lazily kurar. MCP bağlanmaz (canlı MCP
yok), bu yüzden `bim` soruları "canlı MCP bağlı değil" yanıtı döner. Birim
testler bu fabrikayı, enjekte edilmiş bir `ErpClient` ile ağ çağrısı yapmadan
doğrular.

## Bilinen açıklar (dürüst durum)

- **Canlı MCP yok.** Bu ortamda çalışan bir KaplanBIM MCP sunucusu kurulu
  değil; `bim` yolu yalnızca enjekte edilen arayüzü çağırır, gerçek bir MCP'yi
  taklit etmez.
- **Çalışan SSO henüz yok.** KaplanBIM model sunucusu token'ı yalnızca
  JWKS/asimetrik ile doğruluyor; ERP'nin HS256 JWT'sini henüz doğrulayamıyor
  (bkz. Task 2.2 — `deploy/sso/README.md`). ERP köprüsünün taşıdığı SSO bearer
  token'ı (`ERP_ACCESS_TOKEN`) bu yüzden model sunucusu tarafında kabul
  edilmez; kimlik uçtan uca çalışmaz.
- **LLM sağlayıcısı kesinleşmedi.** Karar bir varsayılan hükümdür (firma
  onayı bekleniyor); yapılandırılabilir üçüncü taraf LLM API'si varsayılan,
  self-hosted (Ollama/vLLM) opsiyonel (bkz. Task 2.0 —
  `docs/decisions/2026-11-10-llm-and-sso.md`). Bu katman LLM'i kendisi
  çağırmaz; LLM çağrısı bu yönlendirmenin üstünde, sağlayıcı netleşince bağlanır.
- **`projectId`/`region` varsayılanları.** `queryBoq` bir proje kimliği ister;
  bir bütçe sorusu proje kimliğini taşımaz. Bu katman `options.projectId`
  (varsayılan `demo-project`) ve `options.region` (varsayılan `TR_NATIONAL`)
  kullanır. Gerçek kullanımda bunlar çağıran katman tarafından verilmelidir.
- **Bütçe aşımı teşhisi bu katmanın işi değil.** "Neden aştı" sorusu,
  planlanan (BOQ) ve fiili (harcanan) tutarların karşılaştırılmasını
  gerektirir; bu katman yalnızca ERP'den gelen veriyi aktarır.

## Testler

```bash
cd integrations/assistant
npx vitest run        # hermetic birim testleri (mock'lanmış ERP + MCP)
npx tsc --noEmit      # tip kontrolü
```

Testler (`test/chat.test.ts`): `classifyQuestion` (iki örnek soru + bilinmeyen),
ERP yolu (mock'lanmış köprü, canlı ERP yok), MCP yolu (mock'lanmış MCP; ayrıca
MCP bağlı değilken dürüst yanıt), `unknown` yolu (arka uç çağrılmaz) ve
`createDefaultAssistant` (deps'in gerçek `queryBoq`/`queryCostItem`'a
bağlandığı + enjekte istemciyle ağ olmadan çağrılabildiği).
