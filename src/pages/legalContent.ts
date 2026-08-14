// Obsah právních stránek (Podmínky použití + Zásady ochrany osobních údajů).
// Oddělený od UI i18n kvůli délce. Render zajišťují Terms.tsx / Privacy.tsx.
// Pozn.: e-mail se v renderu automaticky změní na mailto odkaz.

export const LEGAL_EMAIL = 'historyguesser.net@gmail.com'

export type LegalBlock =
  | { t: 'h'; text: string }        // nadpis sekce
  | { t: 'p'; text: string }        // odstavec
  | { t: 'ul'; items: string[] }    // odrážkový seznam
  | { t: 'box'; lines: string[] }   // identifikační karta (provozovatel/správce)

export interface LegalDoc { title: string; updated: string; blocks: LegalBlock[] }
export type LegalLocale = 'cs' | 'en' | 'de'

const OPERATOR = {
  cs: ['Matouš Bahník', 'IČO: 21213887', 'Místo podnikání: Ruprechtická 1334, Liberec, Česká republika', `E-mail: ${LEGAL_EMAIL}`],
  en: ['Matouš Bahník', 'Business ID (IČO): 21213887', 'Place of business: Ruprechtická 1334, Liberec, Czech Republic', `E-mail: ${LEGAL_EMAIL}`],
  de: ['Matouš Bahník', 'ID-Nr. (IČO): 21213887', 'Geschäftssitz: Ruprechtická 1334, Liberec, Tschechien', `E-Mail: ${LEGAL_EMAIL}`],
}

// ─────────────────────────── PODMÍNKY POUŽITÍ ───────────────────────────

export const TERMS: Record<LegalLocale, LegalDoc> = {
  cs: {
    title: 'Podmínky použití HistoryGuesser',
    updated: 'Poslední aktualizace: 10. srpna 2026',
    blocks: [
      { t: 'p', text: 'Tyto podmínky upravují používání webové aplikace HistoryGuesser dostupné na historyguesser.net.' },
      { t: 'p', text: 'Provozovatelem služby je:' },
      { t: 'box', lines: OPERATOR.cs },
      { t: 'p', text: '(dále jen „Provozovatel“).' },

      { t: 'h', text: '1. Přijetí podmínek' },
      { t: 'p', text: 'Používáním aplikace HistoryGuesser souhlasíte s těmito podmínkami použití.' },
      { t: 'p', text: 'Pokud s podmínkami nesouhlasíte, aplikaci nepoužívejte.' },

      { t: 'h', text: '2. Popis služby' },
      { t: 'p', text: 'HistoryGuesser je vzdělávací webová hra zaměřená na historii a geografii.' },
      { t: 'p', text: 'Hráči na základě vizuálního zobrazení historické události a dalších dostupných informací odhadují například místo a rok, ve kterém se daná událost odehrála.' },
      { t: 'p', text: 'Součástí služby mohou být například:' },
      { t: 'ul', items: ['jednotlivé herní režimy,', 'historické události,', 'uživatelské účty,', 'herní statistiky,', 'žebříčky,', 'kampaně,', 'výzvy,', 'achievementy a další herní prvky.'] },
      { t: 'p', text: 'Rozsah a podoba jednotlivých funkcí se mohou v průběhu času měnit.' },

      { t: 'h', text: '3. Uživatelský účet' },
      { t: 'p', text: 'Některé funkce HistoryGuesseru mohou vyžadovat vytvoření uživatelského účtu.' },
      { t: 'p', text: 'Uživatel je povinen:' },
      { t: 'ul', items: ['uvést platnou e-mailovou adresu,', 'chránit přístup ke svému účtu,', 'nepředávat svůj účet jiné osobě způsobem, který by vedl ke zneužití služby,', 'používat uživatelské jméno, které není urážlivé, protiprávní, klamavé nebo vydávající se za jinou osobu.'] },
      { t: 'p', text: 'Jeden uživatel může mít pouze jeden účet, pokud Provozovatel výslovně nepovolí jinak.' },
      { t: 'p', text: 'Uživatel odpovídá za aktivitu prováděnou prostřednictvím svého účtu v rozsahu, v jakém ji mohl rozumně ovlivnit.' },

      { t: 'h', text: '4. Pravidla používání' },
      { t: 'p', text: 'Při používání HistoryGuesseru je zakázáno zejména:' },
      { t: 'ul', items: ['manipulovat se skóre nebo žebříčky,', 'používat boty, skripty nebo jiné prostředky pro automatizované hraní,', 'neoprávněně zasahovat do fungování aplikace,', 'pokoušet se obejít bezpečnostní mechanismy,', 'získávat neoprávněný přístup k účtům nebo datům jiných uživatelů,', 'záměrně využívat technické chyby aplikace za účelem získání neoprávněné výhody,', 'narušovat dostupnost nebo bezpečnost služby,', 'používat aplikaci v rozporu s platnými právními předpisy.'] },
      { t: 'p', text: 'V případě závažného nebo opakovaného porušování těchto pravidel může Provozovatel omezit nebo zablokovat uživatelský účet, odstranit neplatné výsledky nebo uživatele vyřadit ze žebříčků.' },

      { t: 'h', text: '5. Historický obsah a AI vizualizace' },
      { t: 'p', text: 'HistoryGuesser je vzdělávací hra a není odborným historickým zdrojem.' },
      { t: 'p', text: 'Přestože se snažíme o co nejvyšší historickou přesnost, nemůžeme zaručit úplnost nebo absolutní správnost všech informací.' },
      { t: 'p', text: 'Některé obrázky a panoramatické scény zobrazující historické události jsou vytvořeny nebo upraveny pomocí nástrojů umělé inteligence.' },
      { t: 'p', text: 'Tyto obrázky představují vizuální rekonstrukce historických událostí, nikoli autentické historické fotografie daných okamžiků.' },
      { t: 'p', text: 'Vzhled osob, staveb, předmětů, krajiny, rozmístění jednotek a dalších prvků může být pouze přibližnou rekonstrukcí založenou na dostupných historických informacích.' },
      { t: 'p', text: 'Uživatel by proto neměl vizualizace považovat za přesnou dokumentaci skutečné podoby historické události.' },

      { t: 'h', text: '6. Duševní vlastnictví' },
      { t: 'p', text: 'Software HistoryGuesseru, jeho design, databázová struktura, texty, grafické prvky, logo a další obsah vytvořený nebo vlastněný Provozovatelem mohou být chráněny příslušnými právními předpisy.' },
      { t: 'p', text: 'Používáním aplikace uživatel nezískává vlastnická ani jiná práva k tomuto obsahu s výjimkou omezeného práva používat službu pro osobní účely v souladu s těmito podmínkami.' },
      { t: 'p', text: 'Bez předchozího souhlasu Provozovatele není dovoleno chráněný obsah HistoryGuesseru neoprávněně kopírovat, distribuovat, prodávat nebo používat pro vlastní komerční službu.' },
      { t: 'p', text: 'Toto ustanovení se nevztahuje na obsah třetích stran nebo obsah, u kterého taková práva Provozovateli nenáleží.' },

      { t: 'h', text: '7. Bezplatná verze' },
      { t: 'p', text: 'HistoryGuesser může být dostupný v bezplatné verzi.' },
      { t: 'p', text: 'Bezplatná verze může obsahovat reklamy a může mít omezené funkce oproti placeným variantám služby.' },
      { t: 'p', text: 'Rozsah bezplatných funkcí může Provozovatel v průběhu času měnit.' },

      { t: 'h', text: '8. Premium verze' },
      { t: 'p', text: 'HistoryGuesser může nabízet placenou Premium verzi nebo jiné placené funkce.' },
      { t: 'p', text: 'Konkrétní cena, délka předplatného, způsob platby, případné automatické obnovení a možnosti jeho zrušení musí být uživateli zobrazeny před uskutečněním nákupu.' },
      { t: 'p', text: 'Premium může poskytovat například přístup k rozšířenému obsahu nebo funkcím a odstranění reklam.' },
      { t: 'p', text: 'Konkrétní rozsah Premium funkcí je uveden v aplikaci.' },
      { t: 'p', text: 'Pokud je Premium poskytováno formou automaticky obnovovaného předplatného, musí být tato skutečnost včetně ceny a frekvence plateb jasně uvedena před dokončením nákupu.' },
      { t: 'p', text: 'Uživatel musí mít možnost předplatné ukončit způsobem uvedeným při nákupu nebo ve správě svého účtu.' },

      { t: 'h', text: '9. Odstoupení od smlouvy a digitální služba' },
      { t: 'p', text: 'Pokud je uživatel spotřebitelem, má práva vyplývající z příslušných právních předpisů na ochranu spotřebitele.' },
      { t: 'p', text: 'U placených digitálních služeb mohou platit zvláštní pravidla týkající se práva odstoupit od smlouvy.' },
      { t: 'p', text: 'Pokud uživatel požádá o zpřístupnění placené digitální služby před uplynutím zákonné lhůty pro odstoupení, mohou být před zahájením služby vyžadovány příslušné souhlasy nebo potvrzení podle platných právních předpisů.' },
      { t: 'p', text: 'Podrobné informace o ceně, platbě, poskytování digitální služby a případném právu na odstoupení budou uživateli poskytnuty před dokončením nákupu.' },
      { t: 'p', text: 'Tímto ustanovením nejsou omezena zákonná práva spotřebitele.' },

      { t: 'h', text: '10. Reklamy' },
      { t: 'p', text: 'Bezplatná verze HistoryGuesseru může zobrazovat reklamy poskytované třetími stranami, například prostřednictvím Google AdSense.' },
      { t: 'p', text: 'Zobrazení reklamy neznamená, že Provozovatel daný produkt, službu nebo inzerenta doporučuje.' },
      { t: 'p', text: 'Premium verze může být poskytována bez reklam podle podmínek uvedených při jejím zakoupení.' },

      { t: 'h', text: '11. Dostupnost služby' },
      { t: 'p', text: 'HistoryGuesser je poskytován v aktuálně dostupné podobě.' },
      { t: 'p', text: 'Přestože se snažíme udržovat službu funkční a dostupnou, nemůžeme zaručit její nepřetržitou nebo bezchybnou dostupnost.' },
      { t: 'p', text: 'Služba může být dočasně nedostupná například z důvodu:' },
      { t: 'ul', items: ['údržby,', 'aktualizací,', 'technických problémů,', 'výpadků poskytovatelů třetích stran,', 'bezpečnostních incidentů,', 'okolností mimo kontrolu Provozovatele.'] },
      { t: 'p', text: 'Provozovatel může jednotlivé funkce aplikace měnit, přidávat nebo odstraňovat.' },
      { t: 'p', text: 'Tím nejsou dotčena zákonná práva uživatelů, zejména spotřebitelů ve vztahu k již zakoupeným placeným službám.' },

      { t: 'h', text: '12. Odpovědnost' },
      { t: 'p', text: 'HistoryGuesser má především vzdělávací a zábavní charakter.' },
      { t: 'p', text: 'Provozovatel neodpovídá za absolutní historickou přesnost veškerého herního obsahu nebo AI vizualizací.' },
      { t: 'p', text: 'V rozsahu povoleném platnými právními předpisy Provozovatel neodpovídá za škody způsobené okolnostmi, které nemohl rozumně ovlivnit, například výpadkem externí infrastruktury nebo služeb třetích stran.' },
      { t: 'p', text: 'Žádné ustanovení těchto podmínek nevylučuje ani neomezuje odpovědnost, kterou podle platných právních předpisů nelze smluvně vyloučit nebo omezit.' },
      { t: 'p', text: 'Tím nejsou dotčena zákonná práva spotřebitele.' },

      { t: 'h', text: '13. Zrušení účtu' },
      { t: 'p', text: `Uživatel může požádat o odstranění svého účtu prostřednictvím funkce dostupné v aplikaci, pokud je k dispozici, nebo kontaktováním Provozovatele na: ${LEGAL_EMAIL}` },
      { t: 'p', text: 'Provozovatel může účet omezit nebo zrušit zejména v případě závažného nebo opakovaného porušování těchto podmínek.' },
      { t: 'p', text: 'Pokud má uživatel aktivní placenou službu, budou při ukončení účtu respektována jeho práva vyplývající z platných právních předpisů a podmínek konkrétní placené služby.' },

      { t: 'h', text: '14. Ukončení nebo změna služby' },
      { t: 'p', text: 'Provozovatel si vyhrazuje právo HistoryGuesser nebo některé jeho funkce změnit, omezit nebo ukončit.' },
      { t: 'p', text: 'Pokud by změna nebo ukončení služby významně ovlivnily uživatele placené služby, bude postupováno v souladu s platnými právními předpisy a uživatel bude v přiměřeném předstihu informován, pokud to okolnosti umožňují nebo právní předpisy vyžadují.' },

      { t: 'h', text: '15. Změny podmínek' },
      { t: 'p', text: 'Tyto podmínky mohou být průběžně aktualizovány například z důvodu změn služby, obchodního modelu nebo právních požadavků.' },
      { t: 'p', text: 'Aktuální verze bude vždy zveřejněna v aplikaci.' },
      { t: 'p', text: 'O významných změnách, které se podstatně dotýkají registrovaných uživatelů, můžeme uživatele informovat prostřednictvím aplikace nebo e-mailem.' },

      { t: 'h', text: '16. Rozhodné právo' },
      { t: 'p', text: 'Tyto podmínky se řídí právním řádem České republiky.' },
      { t: 'p', text: 'Pokud je uživatel spotřebitelem s bydlištěm v jiném státě, nejsou tím dotčena práva, která mu poskytují závazné právní předpisy příslušné země a která nelze smluvně vyloučit.' },

      { t: 'h', text: '17. Mimosoudní řešení spotřebitelských sporů' },
      { t: 'p', text: 'Pokud mezi Provozovatelem a spotřebitelem vznikne spor, který se nepodaří vyřešit přímo, může mít spotřebitel právo obrátit se na příslušný subjekt mimosoudního řešení spotřebitelských sporů.' },
      { t: 'p', text: 'V České republice je tímto subjektem pro běžné spotřebitelské spory zpravidla Česká obchodní inspekce.' },

      { t: 'h', text: '18. Kontakt' },
      { t: 'p', text: `V případě dotazů týkajících se těchto podmínek nás kontaktujte na: ${LEGAL_EMAIL}` },
    ],
  },

  en: {
    title: 'HistoryGuesser Terms of Use',
    updated: 'Last updated: 10 August 2026',
    blocks: [
      { t: 'p', text: 'These terms govern the use of the HistoryGuesser web application available at historyguesser.net.' },
      { t: 'p', text: 'The service is operated by:' },
      { t: 'box', lines: OPERATOR.en },
      { t: 'p', text: '(hereinafter the “Operator”).' },

      { t: 'h', text: '1. Acceptance of the terms' },
      { t: 'p', text: 'By using the HistoryGuesser application you agree to these terms of use.' },
      { t: 'p', text: 'If you do not agree with the terms, do not use the application.' },

      { t: 'h', text: '2. Description of the service' },
      { t: 'p', text: 'HistoryGuesser is an educational web game focused on history and geography.' },
      { t: 'p', text: 'Based on a visual depiction of a historical event and other available information, players guess, for example, the place and year in which the event took place.' },
      { t: 'p', text: 'The service may include, for example:' },
      { t: 'ul', items: ['individual game modes,', 'historical events,', 'user accounts,', 'game statistics,', 'leaderboards,', 'campaigns,', 'challenges,', 'achievements and other game elements.'] },
      { t: 'p', text: 'The scope and form of individual features may change over time.' },

      { t: 'h', text: '3. User account' },
      { t: 'p', text: 'Some HistoryGuesser features may require the creation of a user account.' },
      { t: 'p', text: 'The user is obliged to:' },
      { t: 'ul', items: ['provide a valid e-mail address,', 'protect access to their account,', 'not transfer their account to another person in a way that would lead to misuse of the service,', 'use a username that is not offensive, unlawful, deceptive, or impersonating another person.'] },
      { t: 'p', text: 'A single user may have only one account, unless the Operator expressly permits otherwise.' },
      { t: 'p', text: 'The user is responsible for activity carried out through their account to the extent they could reasonably influence it.' },

      { t: 'h', text: '4. Rules of use' },
      { t: 'p', text: 'When using HistoryGuesser it is prohibited in particular to:' },
      { t: 'ul', items: ['manipulate scores or leaderboards,', 'use bots, scripts, or other means of automated play,', 'interfere with the functioning of the application without authorization,', 'attempt to circumvent security mechanisms,', 'gain unauthorized access to other users’ accounts or data,', 'deliberately exploit technical errors of the application to gain an unfair advantage,', 'disrupt the availability or security of the service,', 'use the application in violation of applicable law.'] },
      { t: 'p', text: 'In the event of serious or repeated breaches of these rules, the Operator may restrict or block a user account, remove invalid results, or exclude the user from leaderboards.' },

      { t: 'h', text: '5. Historical content and AI visualizations' },
      { t: 'p', text: 'HistoryGuesser is an educational game and is not an expert historical source.' },
      { t: 'p', text: 'Although we strive for the highest possible historical accuracy, we cannot guarantee the completeness or absolute correctness of all information.' },
      { t: 'p', text: 'Some images and panoramic scenes depicting historical events are created or modified using artificial intelligence tools.' },
      { t: 'p', text: 'These images are visual reconstructions of historical events, not authentic historical photographs of those moments.' },
      { t: 'p', text: 'The appearance of people, buildings, objects, landscapes, the placement of units, and other elements may be only an approximate reconstruction based on available historical information.' },
      { t: 'p', text: 'The user should therefore not consider the visualizations to be an accurate record of the real appearance of a historical event.' },

      { t: 'h', text: '6. Intellectual property' },
      { t: 'p', text: 'The HistoryGuesser software, its design, database structure, texts, graphic elements, logo, and other content created or owned by the Operator may be protected by applicable law.' },
      { t: 'p', text: 'By using the application the user does not acquire any ownership or other rights to this content, except for the limited right to use the service for personal purposes in accordance with these terms.' },
      { t: 'p', text: 'Without the Operator’s prior consent, it is not permitted to unlawfully copy, distribute, sell, or use the protected HistoryGuesser content for one’s own commercial service.' },
      { t: 'p', text: 'This provision does not apply to third-party content or content to which such rights do not belong to the Operator.' },

      { t: 'h', text: '7. Free version' },
      { t: 'p', text: 'HistoryGuesser may be available in a free version.' },
      { t: 'p', text: 'The free version may contain advertising and may have limited features compared to paid variants of the service.' },
      { t: 'p', text: 'The Operator may change the scope of free features over time.' },

      { t: 'h', text: '8. Premium version' },
      { t: 'p', text: 'HistoryGuesser may offer a paid Premium version or other paid features.' },
      { t: 'p', text: 'The specific price, subscription length, payment method, any automatic renewal, and the options for cancelling it must be shown to the user before the purchase is made.' },
      { t: 'p', text: 'Premium may provide, for example, access to extended content or features and the removal of ads.' },
      { t: 'p', text: 'The specific scope of Premium features is stated in the application.' },
      { t: 'p', text: 'If Premium is provided as an automatically renewing subscription, this fact, including the price and frequency of payments, must be clearly stated before the purchase is completed.' },
      { t: 'p', text: 'The user must be able to cancel the subscription in the manner stated at purchase or in their account settings.' },

      { t: 'h', text: '9. Withdrawal from the contract and digital service' },
      { t: 'p', text: 'If the user is a consumer, they have the rights arising from the applicable consumer protection legislation.' },
      { t: 'p', text: 'Special rules regarding the right to withdraw from the contract may apply to paid digital services.' },
      { t: 'p', text: 'If the user requests access to a paid digital service before the statutory withdrawal period expires, the relevant consents or confirmations required by applicable law may be required before the service begins.' },
      { t: 'p', text: 'Detailed information about the price, payment, provision of the digital service, and any right of withdrawal will be provided to the user before the purchase is completed.' },
      { t: 'p', text: 'This provision does not limit the statutory rights of the consumer.' },

      { t: 'h', text: '10. Advertising' },
      { t: 'p', text: 'The free version of HistoryGuesser may display advertising provided by third parties, for example via Google AdSense.' },
      { t: 'p', text: 'Displaying an advertisement does not mean that the Operator endorses the given product, service, or advertiser.' },
      { t: 'p', text: 'The Premium version may be provided without advertising under the terms stated at the time of its purchase.' },

      { t: 'h', text: '11. Availability of the service' },
      { t: 'p', text: 'HistoryGuesser is provided in its currently available form.' },
      { t: 'p', text: 'Although we strive to keep the service functional and available, we cannot guarantee its continuous or error-free availability.' },
      { t: 'p', text: 'The service may be temporarily unavailable, for example due to:' },
      { t: 'ul', items: ['maintenance,', 'updates,', 'technical problems,', 'outages of third-party providers,', 'security incidents,', 'circumstances beyond the Operator’s control.'] },
      { t: 'p', text: 'The Operator may change, add, or remove individual features of the application.' },
      { t: 'p', text: 'This does not affect the statutory rights of users, in particular consumers, in relation to already purchased paid services.' },

      { t: 'h', text: '12. Liability' },
      { t: 'p', text: 'HistoryGuesser is primarily educational and entertaining in nature.' },
      { t: 'p', text: 'The Operator is not liable for the absolute historical accuracy of all game content or AI visualizations.' },
      { t: 'p', text: 'To the extent permitted by applicable law, the Operator is not liable for damage caused by circumstances it could not reasonably influence, for example an outage of external infrastructure or third-party services.' },
      { t: 'p', text: 'No provision of these terms excludes or limits liability that cannot be excluded or limited by contract under applicable law.' },
      { t: 'p', text: 'This does not affect the statutory rights of the consumer.' },

      { t: 'h', text: '13. Account cancellation' },
      { t: 'p', text: `The user may request the removal of their account via a feature available in the application, if provided, or by contacting the Operator at: ${LEGAL_EMAIL}` },
      { t: 'p', text: 'The Operator may restrict or cancel an account, in particular in the case of serious or repeated breaches of these terms.' },
      { t: 'p', text: 'If the user has an active paid service, their rights arising from applicable law and the terms of the specific paid service will be respected upon termination of the account.' },

      { t: 'h', text: '14. Termination or change of the service' },
      { t: 'p', text: 'The Operator reserves the right to change, restrict, or terminate HistoryGuesser or some of its features.' },
      { t: 'p', text: 'If a change or termination of the service would significantly affect users of a paid service, it will proceed in accordance with applicable law and the user will be informed with reasonable advance notice, where circumstances allow or the law requires.' },

      { t: 'h', text: '15. Changes to the terms' },
      { t: 'p', text: 'These terms may be updated from time to time, for example due to changes in the service, business model, or legal requirements.' },
      { t: 'p', text: 'The current version will always be published in the application.' },
      { t: 'p', text: 'We may inform users of significant changes that materially affect registered users via the application or by e-mail.' },

      { t: 'h', text: '16. Governing law' },
      { t: 'p', text: 'These terms are governed by the law of the Czech Republic.' },
      { t: 'p', text: 'If the user is a consumer residing in another country, this does not affect the rights afforded to them by the mandatory legislation of the relevant country that cannot be excluded by contract.' },

      { t: 'h', text: '17. Out-of-court resolution of consumer disputes' },
      { t: 'p', text: 'If a dispute arises between the Operator and a consumer that cannot be resolved directly, the consumer may have the right to turn to the competent body for the out-of-court resolution of consumer disputes.' },
      { t: 'p', text: 'In the Czech Republic, this body for ordinary consumer disputes is generally the Czech Trade Inspection Authority (Česká obchodní inspekce).' },

      { t: 'h', text: '18. Contact' },
      { t: 'p', text: `For questions regarding these terms, contact us at: ${LEGAL_EMAIL}` },
    ],
  },

  de: {
    title: 'Nutzungsbedingungen von HistoryGuesser',
    updated: 'Zuletzt aktualisiert: 10. August 2026',
    blocks: [
      { t: 'p', text: 'Diese Bedingungen regeln die Nutzung der unter historyguesser.net verfügbaren Web-Anwendung HistoryGuesser.' },
      { t: 'p', text: 'Betreiber des Dienstes ist:' },
      { t: 'box', lines: OPERATOR.de },
      { t: 'p', text: '(nachfolgend „Betreiber“).' },

      { t: 'h', text: '1. Annahme der Bedingungen' },
      { t: 'p', text: 'Durch die Nutzung der Anwendung HistoryGuesser stimmen Sie diesen Nutzungsbedingungen zu.' },
      { t: 'p', text: 'Wenn Sie mit den Bedingungen nicht einverstanden sind, nutzen Sie die Anwendung nicht.' },

      { t: 'h', text: '2. Beschreibung des Dienstes' },
      { t: 'p', text: 'HistoryGuesser ist ein Lern-Web-Spiel mit Fokus auf Geschichte und Geografie.' },
      { t: 'p', text: 'Auf Grundlage einer visuellen Darstellung eines historischen Ereignisses und weiterer verfügbarer Informationen erraten die Spieler beispielsweise den Ort und das Jahr, in dem das Ereignis stattgefunden hat.' },
      { t: 'p', text: 'Bestandteil des Dienstes können beispielsweise sein:' },
      { t: 'ul', items: ['einzelne Spielmodi,', 'historische Ereignisse,', 'Benutzerkonten,', 'Spielstatistiken,', 'Ranglisten,', 'Kampagnen,', 'Herausforderungen,', 'Achievements und weitere Spielelemente.'] },
      { t: 'p', text: 'Umfang und Form der einzelnen Funktionen können sich im Laufe der Zeit ändern.' },

      { t: 'h', text: '3. Benutzerkonto' },
      { t: 'p', text: 'Einige Funktionen von HistoryGuesser können die Erstellung eines Benutzerkontos erfordern.' },
      { t: 'p', text: 'Der Nutzer ist verpflichtet:' },
      { t: 'ul', items: ['eine gültige E-Mail-Adresse anzugeben,', 'den Zugang zu seinem Konto zu schützen,', 'sein Konto nicht auf eine Weise an eine andere Person weiterzugeben, die zu einem Missbrauch des Dienstes führen würde,', 'einen Benutzernamen zu verwenden, der nicht beleidigend, rechtswidrig, irreführend ist oder sich als eine andere Person ausgibt.'] },
      { t: 'p', text: 'Ein Nutzer darf nur ein Konto haben, sofern der Betreiber nicht ausdrücklich etwas anderes gestattet.' },
      { t: 'p', text: 'Der Nutzer haftet für die über sein Konto durchgeführte Aktivität in dem Umfang, in dem er sie vernünftigerweise beeinflussen konnte.' },

      { t: 'h', text: '4. Nutzungsregeln' },
      { t: 'p', text: 'Bei der Nutzung von HistoryGuesser ist insbesondere untersagt:' },
      { t: 'ul', items: ['Punktzahlen oder Ranglisten zu manipulieren,', 'Bots, Skripte oder andere Mittel für automatisiertes Spielen zu verwenden,', 'unbefugt in die Funktion der Anwendung einzugreifen,', 'zu versuchen, Sicherheitsmechanismen zu umgehen,', 'unbefugten Zugriff auf Konten oder Daten anderer Nutzer zu erlangen,', 'technische Fehler der Anwendung absichtlich zur Erlangung eines unrechtmäßigen Vorteils auszunutzen,', 'die Verfügbarkeit oder Sicherheit des Dienstes zu stören,', 'die Anwendung entgegen geltenden Rechtsvorschriften zu nutzen.'] },
      { t: 'p', text: 'Bei schwerwiegenden oder wiederholten Verstößen gegen diese Regeln kann der Betreiber ein Benutzerkonto einschränken oder sperren, ungültige Ergebnisse entfernen oder den Nutzer aus den Ranglisten ausschließen.' },

      { t: 'h', text: '5. Historische Inhalte und KI-Visualisierungen' },
      { t: 'p', text: 'HistoryGuesser ist ein Lernspiel und keine fachliche historische Quelle.' },
      { t: 'p', text: 'Obwohl wir uns um höchstmögliche historische Genauigkeit bemühen, können wir die Vollständigkeit oder absolute Richtigkeit aller Informationen nicht garantieren.' },
      { t: 'p', text: 'Einige Bilder und Panoramaszenen, die historische Ereignisse darstellen, werden mit Werkzeugen der künstlichen Intelligenz erstellt oder bearbeitet.' },
      { t: 'p', text: 'Diese Bilder sind visuelle Rekonstruktionen historischer Ereignisse, keine authentischen historischen Fotografien dieser Momente.' },
      { t: 'p', text: 'Das Aussehen von Personen, Bauwerken, Gegenständen, Landschaften, die Aufstellung von Einheiten und weitere Elemente können nur eine annähernde Rekonstruktion auf Grundlage verfügbarer historischer Informationen sein.' },
      { t: 'p', text: 'Der Nutzer sollte die Visualisierungen daher nicht als genaue Dokumentation des tatsächlichen Aussehens eines historischen Ereignisses betrachten.' },

      { t: 'h', text: '6. Geistiges Eigentum' },
      { t: 'p', text: 'Die Software von HistoryGuesser, ihr Design, die Datenbankstruktur, Texte, grafische Elemente, das Logo und weitere vom Betreiber erstellte oder gehaltene Inhalte können durch die einschlägigen Rechtsvorschriften geschützt sein.' },
      { t: 'p', text: 'Durch die Nutzung der Anwendung erwirbt der Nutzer keine Eigentums- oder sonstigen Rechte an diesen Inhalten, mit Ausnahme des beschränkten Rechts, den Dienst für persönliche Zwecke im Einklang mit diesen Bedingungen zu nutzen.' },
      { t: 'p', text: 'Ohne vorherige Zustimmung des Betreibers ist es nicht gestattet, geschützte Inhalte von HistoryGuesser unbefugt zu kopieren, zu verbreiten, zu verkaufen oder für einen eigenen kommerziellen Dienst zu nutzen.' },
      { t: 'p', text: 'Diese Bestimmung gilt nicht für Inhalte Dritter oder Inhalte, an denen dem Betreiber solche Rechte nicht zustehen.' },

      { t: 'h', text: '7. Kostenlose Version' },
      { t: 'p', text: 'HistoryGuesser kann in einer kostenlosen Version verfügbar sein.' },
      { t: 'p', text: 'Die kostenlose Version kann Werbung enthalten und kann im Vergleich zu kostenpflichtigen Varianten des Dienstes eingeschränkte Funktionen haben.' },
      { t: 'p', text: 'Der Betreiber kann den Umfang der kostenlosen Funktionen im Laufe der Zeit ändern.' },

      { t: 'h', text: '8. Premium-Version' },
      { t: 'p', text: 'HistoryGuesser kann eine kostenpflichtige Premium-Version oder andere kostenpflichtige Funktionen anbieten.' },
      { t: 'p', text: 'Der konkrete Preis, die Dauer des Abonnements, die Zahlungsweise, eine etwaige automatische Verlängerung und die Möglichkeiten ihrer Kündigung müssen dem Nutzer vor dem Kauf angezeigt werden.' },
      { t: 'p', text: 'Premium kann beispielsweise Zugang zu erweiterten Inhalten oder Funktionen und die Entfernung von Werbung bieten.' },
      { t: 'p', text: 'Der konkrete Umfang der Premium-Funktionen ist in der Anwendung angegeben.' },
      { t: 'p', text: 'Wird Premium in Form eines sich automatisch verlängernden Abonnements bereitgestellt, muss diese Tatsache einschließlich Preis und Zahlungshäufigkeit vor Abschluss des Kaufs klar angegeben werden.' },
      { t: 'p', text: 'Der Nutzer muss das Abonnement auf die beim Kauf angegebene Weise oder in der Verwaltung seines Kontos kündigen können.' },

      { t: 'h', text: '9. Widerruf des Vertrags und digitale Dienstleistung' },
      { t: 'p', text: 'Ist der Nutzer Verbraucher, stehen ihm die Rechte aus den einschlägigen Verbraucherschutzvorschriften zu.' },
      { t: 'p', text: 'Für kostenpflichtige digitale Dienstleistungen können besondere Regeln bezüglich des Widerrufsrechts gelten.' },
      { t: 'p', text: 'Verlangt der Nutzer die Bereitstellung einer kostenpflichtigen digitalen Dienstleistung vor Ablauf der gesetzlichen Widerrufsfrist, können vor Beginn der Dienstleistung die nach geltendem Recht erforderlichen Zustimmungen oder Bestätigungen verlangt werden.' },
      { t: 'p', text: 'Detaillierte Informationen zu Preis, Zahlung, Bereitstellung der digitalen Dienstleistung und einem etwaigen Widerrufsrecht werden dem Nutzer vor Abschluss des Kaufs bereitgestellt.' },
      { t: 'p', text: 'Diese Bestimmung schränkt die gesetzlichen Rechte des Verbrauchers nicht ein.' },

      { t: 'h', text: '10. Werbung' },
      { t: 'p', text: 'Die kostenlose Version von HistoryGuesser kann von Dritten bereitgestellte Werbung anzeigen, beispielsweise über Google AdSense.' },
      { t: 'p', text: 'Die Anzeige einer Werbung bedeutet nicht, dass der Betreiber das jeweilige Produkt, die Dienstleistung oder den Werbetreibenden empfiehlt.' },
      { t: 'p', text: 'Die Premium-Version kann gemäß den beim Kauf angegebenen Bedingungen werbefrei bereitgestellt werden.' },

      { t: 'h', text: '11. Verfügbarkeit des Dienstes' },
      { t: 'p', text: 'HistoryGuesser wird in seiner aktuell verfügbaren Form bereitgestellt.' },
      { t: 'p', text: 'Obwohl wir uns bemühen, den Dienst funktionsfähig und verfügbar zu halten, können wir seine ununterbrochene oder fehlerfreie Verfügbarkeit nicht garantieren.' },
      { t: 'p', text: 'Der Dienst kann vorübergehend nicht verfügbar sein, beispielsweise aufgrund von:' },
      { t: 'ul', items: ['Wartung,', 'Aktualisierungen,', 'technischen Problemen,', 'Ausfällen von Drittanbietern,', 'Sicherheitsvorfällen,', 'Umständen außerhalb der Kontrolle des Betreibers.'] },
      { t: 'p', text: 'Der Betreiber kann einzelne Funktionen der Anwendung ändern, hinzufügen oder entfernen.' },
      { t: 'p', text: 'Die gesetzlichen Rechte der Nutzer, insbesondere von Verbrauchern im Verhältnis zu bereits gekauften kostenpflichtigen Diensten, bleiben davon unberührt.' },

      { t: 'h', text: '12. Haftung' },
      { t: 'p', text: 'HistoryGuesser hat vor allem einen bildenden und unterhaltenden Charakter.' },
      { t: 'p', text: 'Der Betreiber haftet nicht für die absolute historische Genauigkeit sämtlicher Spielinhalte oder KI-Visualisierungen.' },
      { t: 'p', text: 'Im gesetzlich zulässigen Umfang haftet der Betreiber nicht für Schäden, die durch Umstände verursacht wurden, die er vernünftigerweise nicht beeinflussen konnte, beispielsweise durch den Ausfall externer Infrastruktur oder Dienste Dritter.' },
      { t: 'p', text: 'Keine Bestimmung dieser Bedingungen schließt eine Haftung aus oder beschränkt sie, die nach geltendem Recht nicht vertraglich ausgeschlossen oder beschränkt werden kann.' },
      { t: 'p', text: 'Die gesetzlichen Rechte des Verbrauchers bleiben davon unberührt.' },

      { t: 'h', text: '13. Kontolöschung' },
      { t: 'p', text: `Der Nutzer kann die Löschung seines Kontos über eine in der Anwendung verfügbare Funktion, sofern vorhanden, oder durch Kontaktaufnahme mit dem Betreiber beantragen unter: ${LEGAL_EMAIL}` },
      { t: 'p', text: 'Der Betreiber kann ein Konto insbesondere bei schwerwiegenden oder wiederholten Verstößen gegen diese Bedingungen einschränken oder löschen.' },
      { t: 'p', text: 'Hat der Nutzer einen aktiven kostenpflichtigen Dienst, werden bei der Beendigung des Kontos seine Rechte aus geltendem Recht und den Bedingungen des konkreten kostenpflichtigen Dienstes gewahrt.' },

      { t: 'h', text: '14. Beendigung oder Änderung des Dienstes' },
      { t: 'p', text: 'Der Betreiber behält sich das Recht vor, HistoryGuesser oder einige seiner Funktionen zu ändern, einzuschränken oder einzustellen.' },
      { t: 'p', text: 'Würde eine Änderung oder Einstellung des Dienstes Nutzer eines kostenpflichtigen Dienstes erheblich beeinträchtigen, wird im Einklang mit geltendem Recht vorgegangen und der Nutzer wird mit angemessenem Vorlauf informiert, sofern die Umstände dies zulassen oder die Rechtsvorschriften dies erfordern.' },

      { t: 'h', text: '15. Änderungen der Bedingungen' },
      { t: 'p', text: 'Diese Bedingungen können fortlaufend aktualisiert werden, beispielsweise aufgrund von Änderungen des Dienstes, des Geschäftsmodells oder rechtlicher Anforderungen.' },
      { t: 'p', text: 'Die aktuelle Fassung wird stets in der Anwendung veröffentlicht.' },
      { t: 'p', text: 'Über wesentliche Änderungen, die registrierte Nutzer erheblich betreffen, können wir die Nutzer über die Anwendung oder per E-Mail informieren.' },

      { t: 'h', text: '16. Anwendbares Recht' },
      { t: 'p', text: 'Diese Bedingungen unterliegen der Rechtsordnung der Tschechischen Republik.' },
      { t: 'p', text: 'Ist der Nutzer Verbraucher mit Wohnsitz in einem anderen Staat, bleiben die Rechte unberührt, die ihm die zwingenden Rechtsvorschriften des jeweiligen Landes gewähren und die nicht vertraglich ausgeschlossen werden können.' },

      { t: 'h', text: '17. Außergerichtliche Beilegung von Verbraucherstreitigkeiten' },
      { t: 'p', text: 'Entsteht zwischen dem Betreiber und einem Verbraucher eine Streitigkeit, die nicht direkt gelöst werden kann, kann der Verbraucher das Recht haben, sich an die zuständige Stelle für die außergerichtliche Beilegung von Verbraucherstreitigkeiten zu wenden.' },
      { t: 'p', text: 'In der Tschechischen Republik ist diese Stelle für übliche Verbraucherstreitigkeiten in der Regel die Tschechische Handelsinspektion (Česká obchodní inspekce).' },

      { t: 'h', text: '18. Kontakt' },
      { t: 'p', text: `Bei Fragen zu diesen Bedingungen kontaktieren Sie uns unter: ${LEGAL_EMAIL}` },
    ],
  },
}

// ────────────────────── ZÁSADY OCHRANY OSOBNÍCH ÚDAJŮ ──────────────────────

export const PRIVACY: Record<LegalLocale, LegalDoc> = {
  cs: {
    title: 'Zásady ochrany osobních údajů',
    updated: 'Poslední aktualizace: 10. srpna 2026',
    blocks: [
      { t: 'p', text: 'Tyto zásady vysvětlují, jakým způsobem jsou zpracovávány osobní údaje uživatelů webové aplikace HistoryGuesser dostupné na historyguesser.net.' },

      { t: 'h', text: '1. Správce osobních údajů' },
      { t: 'p', text: 'Správcem osobních údajů je:' },
      { t: 'box', lines: OPERATOR.cs },
      { t: 'p', text: '(dále jen „Provozovatel“)' },

      { t: 'h', text: '2. Jaké údaje zpracováváme' },
      { t: 'p', text: 'Při používání HistoryGuesseru můžeme zpracovávat následující údaje:' },
      { t: 'p', text: 'Údaje o uživatelském účtu' },
      { t: 'ul', items: ['e-mailovou adresu,', 'uživatelské jméno,', 'identifikátor uživatelského účtu,', 'informace související s přihlášením a autentizací.'] },
      { t: 'p', text: 'Herní údaje' },
      { t: 'ul', items: ['počet odehraných her,', 'dosažené skóre,', 'výsledky jednotlivých kol,', 'postup ve hře,', 'další statistiky související s používáním aplikace.'] },
      { t: 'p', text: 'Některé údaje, zejména uživatelské jméno a herní výsledky, mohou být veřejně zobrazeny v rámci žebříčků.' },
      { t: 'p', text: 'Technické a analytické údaje' },
      { t: 'p', text: 'Při používání aplikace mohou být zpracovávány technické a analytické informace, například informace o spuštění a dokončení hry, používání jednotlivých funkcí aplikace, informace o relaci nebo další technické údaje nezbytné pro provoz, zabezpečení a zlepšování služby.' },
      { t: 'p', text: 'Údaje související s reklamou' },
      { t: 'p', text: 'V bezplatné verzi HistoryGuesseru mohou být zobrazovány reklamy prostřednictvím služby Google AdSense. V závislosti na uděleném souhlasu mohou Google a jeho reklamní partneři používat cookies nebo podobné technologie a zpracovávat údaje související se zařízením a používáním webu za účelem zobrazování, měření a případně personalizace reklam.' },

      { t: 'h', text: '3. Účely a právní základy zpracování' },
      { t: 'p', text: 'Osobní údaje zpracováváme zejména za následujícími účely:' },
      { t: 'p', text: 'Provoz uživatelského účtu a poskytování služby' },
      { t: 'p', text: 'Údaje potřebujeme například k vytvoření účtu, přihlášení, ukládání herního postupu a zobrazování statistik. Právním základem je plnění smlouvy, respektive poskytování služby na žádost uživatele.' },
      { t: 'p', text: 'Žebříčky a herní funkce' },
      { t: 'p', text: 'Uživatelské jméno a herní výsledky mohou být používány pro fungování žebříčků a dalších herních funkcí. Právním základem je poskytování služby a její herní funkcionality.' },
      { t: 'p', text: 'Bezpečnost a ochrana služby' },
      { t: 'p', text: 'Některé technické údaje můžeme zpracovávat za účelem zabezpečení aplikace, prevence podvodů, zneužívání služby nebo manipulace s výsledky. Právním základem je náš oprávněný zájem na bezpečném provozu služby.' },
      { t: 'p', text: 'Analýza a zlepšování aplikace' },
      { t: 'p', text: 'Údaje o používání aplikace můžeme využívat k odhalování chyb a zlepšování funkcí HistoryGuesseru. Právním základem může být náš oprávněný zájem nebo souhlas uživatele, pokud je podle platných právních předpisů vyžadován.' },
      { t: 'p', text: 'Reklama' },
      { t: 'p', text: 'V bezplatné verzi mohou být zobrazovány reklamy. Pokud je pro ukládání reklamních cookies nebo jiné obdobné zpracování vyžadován souhlas, dochází k takovému zpracování až na základě souhlasu uživatele.' },
      { t: 'p', text: 'Komunikace s uživatelem' },
      { t: 'p', text: 'E-mail můžeme využít k zasílání důležitých informací souvisejících s účtem, bezpečností nebo fungováním služby. Tyto zprávy nejsou marketingovými sděleními.' },

      { t: 'h', text: '4. Cookies a podobné technologie' },
      { t: 'p', text: 'HistoryGuesser může používat cookies a podobné technologie.' },
      { t: 'p', text: 'Technicky nezbytné technologie mohou být používány například pro:' },
      { t: 'ul', items: ['přihlášení uživatele,', 'zabezpečení účtu,', 'zachování relace,', 'základní fungování aplikace.'] },
      { t: 'p', text: 'Tyto technologie mohou být používány bez souhlasu, pokud jsou nezbytné pro poskytování služby požadované uživatelem.' },
      { t: 'p', text: 'Další technologie, zejména související s reklamou, analytikou nebo personalizací, jsou používány pouze v souladu s platnými právními předpisy a tam, kde je to vyžadováno, na základě souhlasu uživatele.' },
      { t: 'p', text: 'Uživatel může svůj souhlas odmítnout nebo později změnit prostřednictvím dostupného nastavení soukromí/cookies.' },

      { t: 'h', text: '5. Reklamy' },
      { t: 'p', text: 'Bezplatná verze HistoryGuesseru může obsahovat reklamy poskytované prostřednictvím Google AdSense.' },
      { t: 'p', text: 'Google a jeho reklamní partneři mohou v závislosti na nastavení souhlasu uživatele používat cookies nebo jiné technologie pro zobrazování a měření reklam a případně pro jejich personalizaci.' },
      { t: 'p', text: 'HistoryGuesser používá mechanismus správy souhlasu odpovídající požadavkům platným pro uživatele v Evropském hospodářském prostoru, Spojeném království a dalších relevantních oblastech.' },
      { t: 'p', text: 'Premium verze HistoryGuesseru reklamy nezobrazuje.' },
      { t: 'p', text: 'Během samotného herního kola se snažíme reklamy nezobrazovat tak, aby nenarušovaly průběh hry.' },

      { t: 'h', text: '6. Komu mohou být údaje předávány' },
      { t: 'p', text: 'Pro provoz HistoryGuesseru využíváme služby třetích stran. Údaje proto mohou být v nezbytném rozsahu zpracovávány zejména následujícími poskytovateli:' },
      { t: 'ul', items: ['Supabase – databáze, autentizace a související cloudové služby,', 'Vercel – hosting a provoz webové aplikace,', 'Google – zejména služba Google AdSense a související reklamní technologie.'] },
      { t: 'p', text: 'Pokud budou v budoucnu používáni další poskytovatelé, kteří zpracovávají osobní údaje, budou tyto zásady odpovídajícím způsobem aktualizovány.' },
      { t: 'p', text: 'Osobní údaje uživatelů neprodáváme.' },

      { t: 'h', text: '7. Předávání údajů mimo Evropský hospodářský prostor' },
      { t: 'p', text: 'Někteří poskytovatelé služeb mohou zpracovávat osobní údaje také mimo Evropský hospodářský prostor.' },
      { t: 'p', text: 'V takovém případě je předávání údajů prováděno v souladu s platnými právními předpisy, například na základě rozhodnutí Evropské komise o odpovídající ochraně, standardních smluvních doložek nebo jiného odpovídajícího právního mechanismu.' },

      { t: 'h', text: '8. Jak dlouho údaje uchováváme' },
      { t: 'p', text: 'Údaje související s uživatelským účtem a herním postupem uchováváme zpravidla po dobu existence uživatelského účtu.' },
      { t: 'p', text: 'Po jeho odstranění mohou být některé údaje po omezenou dobu uchovávány, pokud je to nezbytné pro splnění právních povinností, řešení případných nároků, prevenci podvodů nebo zajištění bezpečnosti služby.' },
      { t: 'p', text: 'Technické záznamy a analytické údaje mohou být uchovávány po dobu nezbytnou pro daný účel.' },
      { t: 'p', text: 'Údaje, které již nejsou potřebné, jsou odstraněny nebo anonymizovány.' },

      { t: 'h', text: '9. Zabezpečení údajů' },
      { t: 'p', text: 'K ochraně osobních údajů používáme přiměřená technická a organizační opatření.' },
      { t: 'p', text: 'Data aplikace jsou ukládána prostřednictvím cloudových služeb a přístup k nim je omezen podle oprávnění uživatelů.' },
      { t: 'p', text: 'V databázi využíváme mimo jiné Row Level Security (RLS), která omezuje přístup uživatelů k údajům podle nastavených oprávnění.' },
      { t: 'p', text: 'Žádný způsob ukládání nebo přenosu dat však nemůže zaručit absolutní bezpečnost.' },

      { t: 'h', text: '10. Práva uživatele' },
      { t: 'p', text: 'V souvislosti se zpracováním osobních údajů můžete mít podle GDPR zejména právo:' },
      { t: 'ul', items: ['získat informace o zpracování svých osobních údajů,', 'požadovat přístup ke svým osobním údajům,', 'požadovat opravu nepřesných údajů,', 'požadovat výmaz osobních údajů,', 'požadovat omezení zpracování,', 'získat své údaje ve strukturovaném a strojově čitelném formátu, pokud jsou splněny zákonné podmínky,', 'vznést námitku proti zpracování založenému na oprávněném zájmu,', 'kdykoli odvolat udělený souhlas, aniž by tím byla dotčena zákonnost předchozího zpracování,', 'podat stížnost u příslušného dozorového úřadu.'] },
      { t: 'p', text: 'V České republice je dozorovým orgánem Úřad pro ochranu osobních údajů (ÚOOÚ).' },

      { t: 'h', text: '11. Smazání účtu' },
      { t: 'p', text: `Pokud chcete svůj účet a související osobní údaje odstranit, využijte příslušnou funkci v aplikaci, pokud je dostupná, nebo nás kontaktujte na: ${LEGAL_EMAIL}` },
      { t: 'p', text: 'Některé údaje mohou být i po smazání účtu uchovány, pokud jejich uchování vyžadují právní předpisy nebo existuje jiný zákonný důvod.' },

      { t: 'h', text: '12. Změny těchto zásad' },
      { t: 'p', text: 'Tyto zásady můžeme průběžně aktualizovat například v případě změn fungování HistoryGuesseru, používaných služeb nebo právních požadavků.' },
      { t: 'p', text: 'Datum poslední aktualizace je vždy uvedeno v horní části této stránky.' },
      { t: 'p', text: 'V případě významných změn můžeme registrované uživatele informovat také prostřednictvím aplikace nebo e-mailem.' },

      { t: 'h', text: '13. Kontakt' },
      { t: 'p', text: `V případě dotazů týkajících se ochrany osobních údajů nebo uplatnění vašich práv nás kontaktujte na: ${LEGAL_EMAIL}` },
    ],
  },

  en: {
    title: 'Privacy Policy',
    updated: 'Last updated: 10 August 2026',
    blocks: [
      { t: 'p', text: 'This policy explains how the personal data of users of the HistoryGuesser web application available at historyguesser.net is processed.' },

      { t: 'h', text: '1. Data controller' },
      { t: 'p', text: 'The controller of personal data is:' },
      { t: 'box', lines: OPERATOR.en },
      { t: 'p', text: '(hereinafter the “Operator”)' },

      { t: 'h', text: '2. What data we process' },
      { t: 'p', text: 'When using HistoryGuesser, we may process the following data:' },
      { t: 'p', text: 'User account data' },
      { t: 'ul', items: ['e-mail address,', 'username,', 'user account identifier,', 'information related to sign-in and authentication.'] },
      { t: 'p', text: 'Game data' },
      { t: 'ul', items: ['number of games played,', 'scores achieved,', 'results of individual rounds,', 'progress in the game,', 'other statistics related to the use of the application.'] },
      { t: 'p', text: 'Some data, in particular the username and game results, may be publicly displayed within leaderboards.' },
      { t: 'p', text: 'Technical and analytical data' },
      { t: 'p', text: 'When using the application, technical and analytical information may be processed, for example information about starting and finishing a game, the use of individual application features, session information, or other technical data necessary for the operation, security, and improvement of the service.' },
      { t: 'p', text: 'Advertising-related data' },
      { t: 'p', text: 'In the free version of HistoryGuesser, ads may be displayed via Google AdSense. Depending on the consent granted, Google and its advertising partners may use cookies or similar technologies and process data related to the device and website usage for the purpose of displaying, measuring, and possibly personalizing ads.' },

      { t: 'h', text: '3. Purposes and legal bases of processing' },
      { t: 'p', text: 'We process personal data in particular for the following purposes:' },
      { t: 'p', text: 'Operation of the user account and provision of the service' },
      { t: 'p', text: 'We need the data, for example, to create an account, sign in, save game progress, and display statistics. The legal basis is the performance of a contract, or the provision of the service at the user’s request.' },
      { t: 'p', text: 'Leaderboards and game features' },
      { t: 'p', text: 'The username and game results may be used for the operation of leaderboards and other game features. The legal basis is the provision of the service and its gameplay functionality.' },
      { t: 'p', text: 'Security and protection of the service' },
      { t: 'p', text: 'We may process some technical data to secure the application, prevent fraud, misuse of the service, or manipulation of results. The legal basis is our legitimate interest in the secure operation of the service.' },
      { t: 'p', text: 'Analysis and improvement of the application' },
      { t: 'p', text: 'We may use data about the use of the application to detect errors and improve HistoryGuesser features. The legal basis may be our legitimate interest or the user’s consent, where required by applicable law.' },
      { t: 'p', text: 'Advertising' },
      { t: 'p', text: 'Ads may be displayed in the free version. If consent is required for storing advertising cookies or other similar processing, such processing takes place only on the basis of the user’s consent.' },
      { t: 'p', text: 'Communication with the user' },
      { t: 'p', text: 'We may use the e-mail address to send important information related to the account, security, or operation of the service. These messages are not marketing communications.' },

      { t: 'h', text: '4. Cookies and similar technologies' },
      { t: 'p', text: 'HistoryGuesser may use cookies and similar technologies.' },
      { t: 'p', text: 'Technically necessary technologies may be used, for example, for:' },
      { t: 'ul', items: ['user sign-in,', 'account security,', 'session maintenance,', 'basic functioning of the application.'] },
      { t: 'p', text: 'These technologies may be used without consent if they are necessary to provide the service requested by the user.' },
      { t: 'p', text: 'Other technologies, in particular those related to advertising, analytics, or personalization, are used only in accordance with applicable law and, where required, on the basis of the user’s consent.' },
      { t: 'p', text: 'The user may refuse their consent or change it later through the available privacy/cookie settings.' },

      { t: 'h', text: '5. Advertising' },
      { t: 'p', text: 'The free version of HistoryGuesser may contain ads provided via Google AdSense.' },
      { t: 'p', text: 'Depending on the user’s consent settings, Google and its advertising partners may use cookies or other technologies to display and measure ads and possibly to personalize them.' },
      { t: 'p', text: 'HistoryGuesser uses a consent management mechanism corresponding to the requirements applicable to users in the European Economic Area, the United Kingdom, and other relevant regions.' },
      { t: 'p', text: 'The Premium version of HistoryGuesser does not display ads.' },
      { t: 'p', text: 'During the game round itself, we strive not to display ads in a way that would disrupt gameplay.' },

      { t: 'h', text: '6. To whom data may be transferred' },
      { t: 'p', text: 'We use third-party services to operate HistoryGuesser. Data may therefore be processed, to the necessary extent, in particular by the following providers:' },
      { t: 'ul', items: ['Supabase – database, authentication, and related cloud services,', 'Vercel – hosting and operation of the web application,', 'Google – in particular the Google AdSense service and related advertising technologies.'] },
      { t: 'p', text: 'If other providers processing personal data are used in the future, this policy will be updated accordingly.' },
      { t: 'p', text: 'We do not sell users’ personal data.' },

      { t: 'h', text: '7. Transfer of data outside the European Economic Area' },
      { t: 'p', text: 'Some service providers may also process personal data outside the European Economic Area.' },
      { t: 'p', text: 'In such a case, the transfer of data is carried out in accordance with applicable law, for example on the basis of a European Commission adequacy decision, standard contractual clauses, or another appropriate legal mechanism.' },

      { t: 'h', text: '8. How long we retain data' },
      { t: 'p', text: 'Data related to the user account and game progress is generally retained for the duration of the user account.' },
      { t: 'p', text: 'After its removal, some data may be retained for a limited period if necessary to fulfil legal obligations, handle potential claims, prevent fraud, or ensure the security of the service.' },
      { t: 'p', text: 'Technical records and analytical data may be retained for the period necessary for the given purpose.' },
      { t: 'p', text: 'Data that is no longer needed is deleted or anonymized.' },

      { t: 'h', text: '9. Data security' },
      { t: 'p', text: 'We use appropriate technical and organizational measures to protect personal data.' },
      { t: 'p', text: 'Application data is stored via cloud services and access to it is restricted according to user permissions.' },
      { t: 'p', text: 'In the database we use, among other things, Row Level Security (RLS), which restricts users’ access to data according to the set permissions.' },
      { t: 'p', text: 'However, no method of data storage or transmission can guarantee absolute security.' },

      { t: 'h', text: '10. User rights' },
      { t: 'p', text: 'In connection with the processing of personal data, you may have, in particular, the right under the GDPR to:' },
      { t: 'ul', items: ['obtain information about the processing of your personal data,', 'request access to your personal data,', 'request the correction of inaccurate data,', 'request the erasure of personal data,', 'request the restriction of processing,', 'obtain your data in a structured and machine-readable format, where the statutory conditions are met,', 'object to processing based on a legitimate interest,', 'withdraw a granted consent at any time, without affecting the lawfulness of prior processing,', 'lodge a complaint with the competent supervisory authority.'] },
      { t: 'p', text: 'In the Czech Republic, the supervisory authority is the Office for Personal Data Protection (Úřad pro ochranu osobních údajů, ÚOOÚ).' },

      { t: 'h', text: '11. Account deletion' },
      { t: 'p', text: `If you want to delete your account and related personal data, use the relevant feature in the application, if available, or contact us at: ${LEGAL_EMAIL}` },
      { t: 'p', text: 'Some data may be retained even after account deletion if its retention is required by law or there is another legal ground.' },

      { t: 'h', text: '12. Changes to this policy' },
      { t: 'p', text: 'We may update this policy from time to time, for example in the event of changes to how HistoryGuesser works, the services used, or legal requirements.' },
      { t: 'p', text: 'The date of the last update is always stated at the top of this page.' },
      { t: 'p', text: 'In the event of significant changes, we may also inform registered users via the application or by e-mail.' },

      { t: 'h', text: '13. Contact' },
      { t: 'p', text: `For questions regarding the protection of personal data or the exercise of your rights, contact us at: ${LEGAL_EMAIL}` },
    ],
  },

  de: {
    title: 'Datenschutzerklärung',
    updated: 'Zuletzt aktualisiert: 10. August 2026',
    blocks: [
      { t: 'p', text: 'Diese Erklärung erläutert, wie personenbezogene Daten der Nutzer der unter historyguesser.net verfügbaren Web-Anwendung HistoryGuesser verarbeitet werden.' },

      { t: 'h', text: '1. Verantwortlicher für personenbezogene Daten' },
      { t: 'p', text: 'Verantwortlicher für die personenbezogenen Daten ist:' },
      { t: 'box', lines: OPERATOR.de },
      { t: 'p', text: '(nachfolgend „Betreiber“)' },

      { t: 'h', text: '2. Welche Daten wir verarbeiten' },
      { t: 'p', text: 'Bei der Nutzung von HistoryGuesser können wir folgende Daten verarbeiten:' },
      { t: 'p', text: 'Daten des Benutzerkontos' },
      { t: 'ul', items: ['E-Mail-Adresse,', 'Benutzername,', 'Kennung des Benutzerkontos,', 'Informationen im Zusammenhang mit Anmeldung und Authentifizierung.'] },
      { t: 'p', text: 'Spieldaten' },
      { t: 'ul', items: ['Anzahl gespielter Spiele,', 'erzielte Punktzahlen,', 'Ergebnisse einzelner Runden,', 'Spielfortschritt,', 'weitere Statistiken im Zusammenhang mit der Nutzung der Anwendung.'] },
      { t: 'p', text: 'Einige Daten, insbesondere der Benutzername und Spielergebnisse, können im Rahmen von Ranglisten öffentlich angezeigt werden.' },
      { t: 'p', text: 'Technische und analytische Daten' },
      { t: 'p', text: 'Bei der Nutzung der Anwendung können technische und analytische Informationen verarbeitet werden, beispielsweise Informationen über das Starten und Beenden eines Spiels, die Nutzung einzelner Funktionen der Anwendung, Sitzungsinformationen oder weitere technische Daten, die für den Betrieb, die Sicherheit und die Verbesserung des Dienstes erforderlich sind.' },
      { t: 'p', text: 'Werbebezogene Daten' },
      { t: 'p', text: 'In der kostenlosen Version von HistoryGuesser kann Werbung über den Dienst Google AdSense angezeigt werden. Abhängig von der erteilten Einwilligung können Google und seine Werbepartner Cookies oder ähnliche Technologien verwenden und Daten im Zusammenhang mit dem Gerät und der Website-Nutzung zum Zweck der Anzeige, Messung und gegebenenfalls Personalisierung von Werbung verarbeiten.' },

      { t: 'h', text: '3. Zwecke und Rechtsgrundlagen der Verarbeitung' },
      { t: 'p', text: 'Wir verarbeiten personenbezogene Daten insbesondere zu folgenden Zwecken:' },
      { t: 'p', text: 'Betrieb des Benutzerkontos und Bereitstellung des Dienstes' },
      { t: 'p', text: 'Die Daten benötigen wir beispielsweise zur Erstellung eines Kontos, zur Anmeldung, zum Speichern des Spielfortschritts und zur Anzeige von Statistiken. Rechtsgrundlage ist die Erfüllung eines Vertrags bzw. die Bereitstellung des Dienstes auf Wunsch des Nutzers.' },
      { t: 'p', text: 'Ranglisten und Spielfunktionen' },
      { t: 'p', text: 'Der Benutzername und Spielergebnisse können für den Betrieb von Ranglisten und weiteren Spielfunktionen verwendet werden. Rechtsgrundlage ist die Bereitstellung des Dienstes und seiner Spielfunktionalität.' },
      { t: 'p', text: 'Sicherheit und Schutz des Dienstes' },
      { t: 'p', text: 'Einige technische Daten können wir zur Absicherung der Anwendung, zur Betrugsprävention, zur Verhinderung von Missbrauch des Dienstes oder von Ergebnismanipulation verarbeiten. Rechtsgrundlage ist unser berechtigtes Interesse am sicheren Betrieb des Dienstes.' },
      { t: 'p', text: 'Analyse und Verbesserung der Anwendung' },
      { t: 'p', text: 'Daten über die Nutzung der Anwendung können wir zur Fehlererkennung und Verbesserung der Funktionen von HistoryGuesser nutzen. Rechtsgrundlage kann unser berechtigtes Interesse oder die Einwilligung des Nutzers sein, sofern nach geltendem Recht erforderlich.' },
      { t: 'p', text: 'Werbung' },
      { t: 'p', text: 'In der kostenlosen Version kann Werbung angezeigt werden. Ist für die Speicherung von Werbe-Cookies oder eine andere ähnliche Verarbeitung eine Einwilligung erforderlich, erfolgt eine solche Verarbeitung erst auf Grundlage der Einwilligung des Nutzers.' },
      { t: 'p', text: 'Kommunikation mit dem Nutzer' },
      { t: 'p', text: 'Die E-Mail-Adresse können wir zum Versand wichtiger Informationen im Zusammenhang mit dem Konto, der Sicherheit oder dem Betrieb des Dienstes nutzen. Diese Nachrichten sind keine Marketingmitteilungen.' },

      { t: 'h', text: '4. Cookies und ähnliche Technologien' },
      { t: 'p', text: 'HistoryGuesser kann Cookies und ähnliche Technologien verwenden.' },
      { t: 'p', text: 'Technisch notwendige Technologien können beispielsweise verwendet werden für:' },
      { t: 'ul', items: ['die Anmeldung des Nutzers,', 'die Sicherheit des Kontos,', 'die Aufrechterhaltung der Sitzung,', 'die grundlegende Funktion der Anwendung.'] },
      { t: 'p', text: 'Diese Technologien können ohne Einwilligung verwendet werden, sofern sie für die Bereitstellung des vom Nutzer angeforderten Dienstes erforderlich sind.' },
      { t: 'p', text: 'Weitere Technologien, insbesondere im Zusammenhang mit Werbung, Analyse oder Personalisierung, werden nur im Einklang mit geltendem Recht und, wo erforderlich, auf Grundlage der Einwilligung des Nutzers verwendet.' },
      { t: 'p', text: 'Der Nutzer kann seine Einwilligung verweigern oder später über die verfügbaren Datenschutz-/Cookie-Einstellungen ändern.' },

      { t: 'h', text: '5. Werbung' },
      { t: 'p', text: 'Die kostenlose Version von HistoryGuesser kann über Google AdSense bereitgestellte Werbung enthalten.' },
      { t: 'p', text: 'Google und seine Werbepartner können je nach den Einwilligungseinstellungen des Nutzers Cookies oder andere Technologien zur Anzeige und Messung von Werbung und gegebenenfalls zu deren Personalisierung verwenden.' },
      { t: 'p', text: 'HistoryGuesser verwendet einen Einwilligungsverwaltungsmechanismus, der den für Nutzer im Europäischen Wirtschaftsraum, im Vereinigten Königreich und in weiteren relevanten Regionen geltenden Anforderungen entspricht.' },
      { t: 'p', text: 'Die Premium-Version von HistoryGuesser zeigt keine Werbung an.' },
      { t: 'p', text: 'Während der Spielrunde selbst sind wir bestrebt, keine Werbung so anzuzeigen, dass sie den Spielverlauf stört.' },

      { t: 'h', text: '6. An wen Daten weitergegeben werden können' },
      { t: 'p', text: 'Für den Betrieb von HistoryGuesser nutzen wir Dienste Dritter. Daten können daher im erforderlichen Umfang insbesondere von folgenden Anbietern verarbeitet werden:' },
      { t: 'ul', items: ['Supabase – Datenbank, Authentifizierung und zugehörige Cloud-Dienste,', 'Vercel – Hosting und Betrieb der Web-Anwendung,', 'Google – insbesondere der Dienst Google AdSense und zugehörige Werbetechnologien.'] },
      { t: 'p', text: 'Werden künftig weitere Anbieter eingesetzt, die personenbezogene Daten verarbeiten, wird diese Erklärung entsprechend aktualisiert.' },
      { t: 'p', text: 'Personenbezogene Daten der Nutzer verkaufen wir nicht.' },

      { t: 'h', text: '7. Übermittlung von Daten außerhalb des Europäischen Wirtschaftsraums' },
      { t: 'p', text: 'Einige Dienstanbieter können personenbezogene Daten auch außerhalb des Europäischen Wirtschaftsraums verarbeiten.' },
      { t: 'p', text: 'In einem solchen Fall erfolgt die Übermittlung der Daten im Einklang mit geltendem Recht, beispielsweise auf Grundlage eines Angemessenheitsbeschlusses der Europäischen Kommission, von Standardvertragsklauseln oder eines anderen geeigneten Rechtsmechanismus.' },

      { t: 'h', text: '8. Wie lange wir Daten aufbewahren' },
      { t: 'p', text: 'Daten im Zusammenhang mit dem Benutzerkonto und dem Spielfortschritt bewahren wir in der Regel für die Dauer des Benutzerkontos auf.' },
      { t: 'p', text: 'Nach dessen Löschung können einige Daten für einen begrenzten Zeitraum aufbewahrt werden, sofern dies zur Erfüllung rechtlicher Pflichten, zur Bearbeitung möglicher Ansprüche, zur Betrugsprävention oder zur Gewährleistung der Sicherheit des Dienstes erforderlich ist.' },
      { t: 'p', text: 'Technische Aufzeichnungen und analytische Daten können für den für den jeweiligen Zweck erforderlichen Zeitraum aufbewahrt werden.' },
      { t: 'p', text: 'Daten, die nicht mehr benötigt werden, werden gelöscht oder anonymisiert.' },

      { t: 'h', text: '9. Datensicherheit' },
      { t: 'p', text: 'Zum Schutz personenbezogener Daten setzen wir angemessene technische und organisatorische Maßnahmen ein.' },
      { t: 'p', text: 'Anwendungsdaten werden über Cloud-Dienste gespeichert und der Zugriff darauf ist entsprechend den Berechtigungen der Nutzer beschränkt.' },
      { t: 'p', text: 'In der Datenbank nutzen wir unter anderem Row Level Security (RLS), die den Zugriff der Nutzer auf Daten entsprechend den festgelegten Berechtigungen beschränkt.' },
      { t: 'p', text: 'Keine Methode der Datenspeicherung oder -übertragung kann jedoch absolute Sicherheit garantieren.' },

      { t: 'h', text: '10. Rechte des Nutzers' },
      { t: 'p', text: 'Im Zusammenhang mit der Verarbeitung personenbezogener Daten können Ihnen nach der DSGVO insbesondere folgende Rechte zustehen:' },
      { t: 'ul', items: ['Informationen über die Verarbeitung Ihrer personenbezogenen Daten zu erhalten,', 'Zugang zu Ihren personenbezogenen Daten zu verlangen,', 'die Berichtigung unrichtiger Daten zu verlangen,', 'die Löschung personenbezogener Daten zu verlangen,', 'die Einschränkung der Verarbeitung zu verlangen,', 'Ihre Daten in einem strukturierten und maschinenlesbaren Format zu erhalten, sofern die gesetzlichen Voraussetzungen erfüllt sind,', 'Widerspruch gegen eine auf einem berechtigten Interesse beruhende Verarbeitung einzulegen,', 'eine erteilte Einwilligung jederzeit zu widerrufen, ohne dass die Rechtmäßigkeit der vorherigen Verarbeitung berührt wird,', 'eine Beschwerde bei der zuständigen Aufsichtsbehörde einzureichen.'] },
      { t: 'p', text: 'In der Tschechischen Republik ist die Aufsichtsbehörde das Amt für den Schutz personenbezogener Daten (Úřad pro ochranu osobních údajů, ÚOOÚ).' },

      { t: 'h', text: '11. Kontolöschung' },
      { t: 'p', text: `Wenn Sie Ihr Konto und die zugehörigen personenbezogenen Daten löschen möchten, nutzen Sie die entsprechende Funktion in der Anwendung, sofern verfügbar, oder kontaktieren Sie uns unter: ${LEGAL_EMAIL}` },
      { t: 'p', text: 'Einige Daten können auch nach der Löschung des Kontos aufbewahrt werden, sofern deren Aufbewahrung durch Rechtsvorschriften erforderlich ist oder ein anderer rechtlicher Grund besteht.' },

      { t: 'h', text: '12. Änderungen dieser Erklärung' },
      { t: 'p', text: 'Diese Erklärung können wir fortlaufend aktualisieren, beispielsweise bei Änderungen der Funktionsweise von HistoryGuesser, der genutzten Dienste oder rechtlicher Anforderungen.' },
      { t: 'p', text: 'Das Datum der letzten Aktualisierung ist stets im oberen Teil dieser Seite angegeben.' },
      { t: 'p', text: 'Bei wesentlichen Änderungen können wir registrierte Nutzer auch über die Anwendung oder per E-Mail informieren.' },

      { t: 'h', text: '13. Kontakt' },
      { t: 'p', text: `Bei Fragen zum Schutz personenbezogener Daten oder zur Ausübung Ihrer Rechte kontaktieren Sie uns unter: ${LEGAL_EMAIL}` },
    ],
  },
}
