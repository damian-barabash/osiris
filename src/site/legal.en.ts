// Legal documents — English translation. The Polish version prevails in case of discrepancies.
import type { LegalSet } from "./legal";

const en: LegalSet = {
  updated: "Effective from 25 November 2026",
  note: "This is a translation provided for convenience. In case of any discrepancy, the Polish version prevails.",
  terms: {
    title: "OSIRIS Terms of Service",
    intro: "These Terms set out the rules for using the OSIRIS service and apps available at myosiris.app and in the mobile apps. Please read them carefully before creating an account.",
    sections: [
      { h: "1. Service provider", body: [
        "The service is provided by Maksym Yehorov, a sole trader operating as Maksym Yehorov Maksikon, ul. Zamiany 18 lok. 46, 02-786 Warszawa, Poland, NIP (tax ID): 9512594289, REGON: 528375783 (the “Provider”).",
        "Contact: dbdcstudio@gmail.com. The service was designed and built by DBDC Studio (dbdcstudio.pl).",
      ] },
      { h: "2. Definitions", body: [[
        "Service — the myosiris.app website, the web version of the app at myosiris.app/app and the OSIRIS mobile apps.",
        "User — a natural person aged 16 or over who uses the Service.",
        "Account — the User's individual profile holding their data and content.",
        "Osi — the AI-based assistant available in the Service.",
        "Plan — the scope of features: “Free”, “Little Joys” or “Smarty”.",
      ]] },
      { h: "3. What the Service does", body: [
        "The Service is a planner: it lets you keep a calendar, tasks, a list of clients and projects, records of payments and work hours, goals, notes and mood check-ins, generate PDF reports and use the Osi assistant.",
        "Technical requirements: a device with Internet access, an up-to-date browser with JavaScript and local storage enabled or the mobile app, and an active email address.",
        "The myosiris.app website offers a chat with Osi for visitors who are not logged in. It is limited to a small number of questions and serves only to provide information about the Service.",
      ] },
      { h: "4. Account", body: [
        "You can create an Account with an email address and password or by signing in with Google. The agreement for the provision of electronic services is concluded when the Account is created, for an indefinite period.",
        "You are responsible for keeping your password confidential and for activity carried out through your Account. Please notify the Provider immediately if you suspect unauthorised access.",
        "You may delete your Account at any time by sending a request to dbdcstudio@gmail.com from the email address linked to the Account. Deleting the Account permanently removes your data.",
      ] },
      { h: "5. Plans and payments", body: [
        "The “Free” Plan costs nothing and includes the core features with the limits described in the Service. “Little Joys” (PLN 9.99 per month) and “Smarty” (PLN 29.99 per month) raise those limits, in particular the number of messages to Osi per day. Prices include taxes.",
        "As of the effective date of these Terms, payments operate in test mode: choosing a paid Plan does not result in any charge. The Provider will announce the launch of payments in the Service and update these Terms before the first charge is made.",
        "Once payments are launched, a paid Plan will renew monthly until cancelled. You may cancel at any time with effect at the end of the paid period.",
      ] },
      { h: "6. Right of withdrawal", body: [
        "A consumer (and a sole trader treated as a consumer under Polish law) may withdraw from a distance contract within 14 days without giving a reason by sending a statement to dbdcstudio@gmail.com.",
        "If you request that a paid service begin before the withdrawal period ends, you will pay for the services provided up to the moment of withdrawal. For digital content delivered immediately with your express consent and after you have been informed that you lose the right of withdrawal, that right does not apply to content already delivered.",
      ] },
      { h: "7. The Osi assistant", body: [
        "Osi uses artificial-intelligence models supplied by Anthropic. Answers are generated automatically and may contain errors or inaccuracies. Osi does not provide legal, tax, medical or financial advice.",
        "Osi proposes changes to your data as cards; changes are saved only after you approve them. Please check them before approving.",
        "The number of messages to Osi per day is limited and depends on the Plan.",
      ] },
      { h: "8. Acceptable use", body: [
        "You agree to use the Service lawfully and in line with these Terms. In particular, you must not:",
        [
          "provide unlawful content or content that infringes third-party rights;",
          "attempt to circumvent the security measures, limits or restrictions of the Service, including trying to make Osi act outside its intended purpose;",
          "scrape data automatically, overload the infrastructure or use the Service to send unsolicited messages;",
          "share your Account with others in a way that compromises data security.",
        ],
        "In the event of a serious breach of these Terms, the Provider may restrict access to the Service or terminate the agreement and will inform you accordingly.",
      ] },
      { h: "9. Your content", body: [
        "Content you enter into the Service remains yours. You grant the Provider a non-exclusive licence to store and process it solely to the extent necessary to provide the services.",
        "The friends feature lets you share the titles, times and places of your events and tasks with people you choose. Notes and descriptions are never shared. Mood is shared only with separate consent, which you can withdraw at any time.",
      ] },
      { h: "10. Availability and liability", body: [
        "The Provider makes every effort to keep the Service running continuously but does not guarantee uninterrupted availability. Maintenance breaks may occur; where possible, the Provider gives advance notice.",
        "The Service is a supporting tool. You remain responsible for meeting your own deadlines, including court and official deadlines, and for the accuracy of data in reports you pass on to third parties.",
        "The Provider's liability towards Users who are not consumers is limited to the fees paid in the preceding 12 months. Nothing in these Terms excludes or limits consumer rights under mandatory provisions of law.",
      ] },
      { h: "11. Complaints", body: [
        "Complaints can be sent to dbdcstudio@gmail.com with a description of the problem and the Account's email address. The Provider replies within 14 days of receipt.",
        "Consumers may use out-of-court dispute resolution, for example by contacting a consumer ombudsman or using the ODR platform: https://ec.europa.eu/consumers/odr.",
      ] },
      { h: "12. Changes and final provisions", body: [
        "The Provider may amend these Terms for important reasons: changes in the law, new features or payments, or security. Users will be notified in the Service or by email at least 14 days before the change takes effect. If you do not accept the changes, you may terminate the agreement by deleting your Account.",
        "Matters not covered here are governed by Polish law. This choice of law does not deprive consumers of the protection afforded by the law of their habitual residence.",
      ] },
    ],
  },
  privacy: {
    title: "Privacy Policy",
    intro: "This policy explains what personal data we process when you use OSIRIS, why we do it and what rights you have.",
    sections: [
      { h: "1. Data controller", body: [
        "The controller of personal data is Maksym Yehorov, a sole trader operating as Maksym Yehorov Maksikon, ul. Zamiany 18 lok. 46, 02-786 Warszawa, Poland, NIP: 9512594289, REGON: 528375783.",
        "For any matter concerning personal data, write to dbdcstudio@gmail.com.",
      ] },
      { h: "2. Data we process", body: [[
        "Account data: email address, name, password (as an encrypted hash), profile photo, language, time zone, chosen plan.",
        "Content you enter in the app: events, tasks, clients and projects, payments, work hours, goals, notes, mood check-ins and anything you write in the “What Osi knows about me” field.",
        "Conversations with Osi and assistant usage data (number of messages, token counts, cost).",
        "Technical data: device identifiers for push notifications, error information, an approximate region derived from your time zone, device and browser type.",
        "Guest chat on the website: the question and answer text and a hash of the IP address used to count the question limit. We do not store the IP address itself.",
        "Waiting list: the email address entered in the “Notify me” form.",
      ],
        "We do not ask for special categories of data. Mood check-ins are for your own use; if you enter health information or other sensitive data in the Service, you do so voluntarily.",
      ] },
      { h: "3. Purposes and legal bases", body: [[
        "Providing the services, running your Account, operating the Osi assistant — Art. 6(1)(b) GDPR (performance of a contract).",
        "Security of the Service, abuse prevention, request limits, error log — Art. 6(1)(f) GDPR (legitimate interest).",
        "Anonymous website statistics — Art. 6(1)(a) GDPR (consent given in the cookie banner).",
        "App launch notification (waiting list) — Art. 6(1)(a) GDPR (consent).",
        "Billing and accounting obligations once payments are launched — Art. 6(1)(c) GDPR (legal obligation).",
        "Establishing and defending legal claims — Art. 6(1)(f) GDPR.",
      ]] },
      { h: "4. Artificial intelligence", body: [
        "When you write to Osi, the model provider (Anthropic) receives the message and the necessary context from your Account: upcoming events and tasks, clients and projects with balances, goals, a mood summary, notes and the “What Osi knows about me” field.",
        "This data is used solely to generate the answer. Under Anthropic's commercial terms it is not used to train models. Osi makes no decisions with legal effect on you; every change to your data is approved by you.",
      ] },
      { h: "5. Recipients", body: [
        "We entrust data to providers who help us deliver the services, under data processing agreements:",
        [
          "Supabase — database, authentication, file storage (data centre in the European Union, Ireland);",
          "Anthropic — generating the Osi assistant's answers (USA);",
          "Google — Google sign-in, if you use it;",
          "Apple and Google (Firebase) — delivery of push notifications to the mobile apps;",
          "GitHub — website hosting (USA).",
        ],
        "Friends you add see only the data described in the Terms (titles, times and places; mood only with consent). We do not sell data or share it for advertising.",
      ] },
      { h: "6. Transfers outside the EEA", body: [
        "Some providers are based in the USA. Transfers rely on the European Commission's adequacy decision (EU–U.S. Data Privacy Framework) or on standard contractual clauses.",
      ] },
      { h: "7. Retention", body: [[
        "Account data and content — until the Account is deleted; backups are removed within a further 30 days.",
        "Guest chat conversations and visit statistics — up to 12 months.",
        "Error log and security data — up to 12 months.",
        "Waiting list — until the launch notification is sent or consent is withdrawn.",
        "Billing data — for the period required by tax law.",
      ]] },
      { h: "8. Your rights", body: [
        "You have the right to access your data, rectify it, erase it, restrict its processing, receive it in a portable format, object to processing based on legitimate interest and withdraw consent at any time (without affecting the lawfulness of earlier processing).",
        "To exercise your rights, write to dbdcstudio@gmail.com. You may also lodge a complaint with the President of the Personal Data Protection Office (UODO), ul. Stawki 2, 00-193 Warszawa, Poland, or with the authority in your country.",
      ] },
      { h: "9. Voluntary provision and security", body: [
        "Providing data is voluntary, but an email address is required to create an Account.",
        "We use encrypted connections, access control at database level (each User sees only their own data), hashed passwords and restricted administrative access. The Service is intended for people aged 16 or over.",
      ] },
      { h: "10. Changes", body: ["We will announce material changes in the Service or by email. The current version is always available on this page."] },
    ],
  },
  cookies: {
    title: "Cookie Policy",
    intro: "This page describes what the myosiris.app website stores in your browser and why.",
    sections: [
      { h: "1. What we use", body: [
        "OSIRIS uses no advertising or tracking cookies and embeds no third-party advertising scripts. Instead of classic cookies we use browser storage (localStorage and sessionStorage).",
      ] },
      { h: "2. Necessary", body: [
        "These items are required for the website and app to work and need no consent:",
        { table: [["Name", "Purpose", "Kept"], ["osiris-auth", "login session in the web version", "until you sign out"], ["osiris_lang, osiris_site_lang", "chosen language", "until changed"], ["osiris_theme", "light or dark theme", "until changed"], ["osiris_consent", "your statistics choice", "until changed"], ["cal_mode, cal_start, report_* and similar", "view settings in the app", "until changed"], ["osiris_guest_chat", "the current conversation with Osi on the website", "until the tab is closed"], ["osiris_admin", "administration panel session", "until the tab is closed"]] },
      ] },
      { h: "3. Anonymous statistics", body: [
        "If you consent in the banner, we record a page view on our own server: the page address, referring site, UTM parameters, language, device and browser type and a region derived from your time zone. A visitor is recognised only by a hash that changes every day; we store neither the IP address nor cookies and build no profiles.",
        "We do not use Google Analytics or any other third-party analytics.",
      ] },
      { h: "4. Google sign-in", body: ["If you choose to sign in with Google, you are redirected to Google, which uses its own cookies as described in its privacy policy."] },
      { h: "5. Changing your choice", body: ["You can change your statistics choice at any time via “Cookie settings” in the page footer. You can also clear browser storage in your browser settings — this signs you out and restores the defaults."] },
      { h: "6. Contact", body: ["Questions about this policy can be sent to dbdcstudio@gmail.com."] },
    ],
  },
};
export default en;
