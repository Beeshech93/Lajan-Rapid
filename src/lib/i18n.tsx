import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";

export const LANGUAGES = [
  { code: "es", label: "Español", flag: "🇲🇽" },
  { code: "fr", label: "Français", flag: "🇫🇷" },
  { code: "ht", label: "Kreyòl ayisyen", flag: "🇭🇹" },
  { code: "en", label: "English", flag: "🇺🇸" },
] as const;

export type Lang = (typeof LANGUAGES)[number]["code"];

type Dict = Record<string, string>;

const es: Dict = {
  "app.tagline": "Envíos rápidos a Haití y República Dominicana",
  "nav.home": "Inicio",
  "nav.send": "Enviar",
  "nav.wallet": "Billetera",
  "nav.card": "Tarjeta",
  "nav.history": "Historial",
  "nav.profile": "Perfil",
  "nav.agent": "Agente",
  "nav.admin": "Admin",
  "nav.support": "Soporte",
  "nav.account": "Mi cuenta",
  "nav.signout": "Cerrar sesión",
  "common.language": "Idioma",
  "auth.signin": "Iniciar sesión",
  "auth.signup": "Crear cuenta",
  "auth.welcome": "Bienvenido",
  "auth.subtitle": "Accede o crea tu cuenta en un minuto.",
  "auth.email": "Correo",
  "auth.password": "Contraseña",
  "auth.fullname": "Nombre completo",
  "auth.phone": "Teléfono",
  "auth.country_code": "País",
  "auth.phone_hint": "Elige tu país y escribe tu número, sin el código.",
  "auth.enter": "Entrar",
  "auth.entering": "Entrando…",
  "auth.creating": "Creando…",
  "auth.or": "o",
  "auth.google": "Continuar con Google",
  "auth.created": "¡Cuenta creada!",
  "auth.check_email": "Revisa tu correo para confirmar la cuenta",
  "auth.invalid": "Datos inválidos",
  "auth.invalid_email": "Correo inválido",
  "auth.min_password": "Mínimo 8 caracteres",
  "auth.invalid_phone": "Número de teléfono inválido",
  "auth.error": "No pudimos completar la operación",
  "auth.google_error": "No pudimos conectar con Google",
  "landing.badge": "América y Europa → Haití y R. Dominicana",
  "landing.title": "Envía dinero a casa sin sorpresas",
  "landing.subtitle":
    "Tipo de cambio claro, comisión visible antes de pagar y seguimiento en tiempo real hasta que tu familia recibe el dinero en Haití o República Dominicana.",
  "landing.cta": "Enviar dinero",
  "landing.have_account": "Ya tengo cuenta",
  "landing.stat_minutes": "Minutos",
  "landing.stat_minutes_desc": "Entrega típica",
  "landing.stat_kyc_desc": "Identidad verificada",
  "landing.stat_countries": "+30 países",
  "landing.stat_countries_desc": "De origen",
  "landing.from": "Desde",
  "landing.to": "Hacia",
  "landing.you_send": "Tú envías",
  "landing.rate": "Tipo de cambio",
  "landing.fee": "Comisión",
  "landing.total": "Total a pagar",
  "landing.unavailable": "No disponible",
  "landing.family_gets": "Tu familia recibe",
  "landing.footer": "Lajan Rapid · Remesas hacia Haití y República Dominicana",
};

const fr: Dict = {
  "app.tagline": "Transferts rapides vers Haïti et la République dominicaine",
  "nav.home": "Accueil",
  "nav.send": "Envoyer",
  "nav.wallet": "Portefeuille",
  "nav.card": "Carte",
  "nav.history": "Historique",
  "nav.profile": "Profil",
  "nav.agent": "Agent",
  "nav.admin": "Admin",
  "nav.support": "Support",
  "nav.account": "Mon compte",
  "nav.signout": "Se déconnecter",
  "common.language": "Langue",
  "auth.signin": "Se connecter",
  "auth.signup": "Créer un compte",
  "auth.welcome": "Bienvenue",
  "auth.subtitle": "Connectez-vous ou créez votre compte en une minute.",
  "auth.email": "E-mail",
  "auth.password": "Mot de passe",
  "auth.fullname": "Nom complet",
  "auth.phone": "Téléphone",
  "auth.country_code": "Pays",
  "auth.phone_hint": "Choisissez votre pays et saisissez votre numéro, sans l'indicatif.",
  "auth.enter": "Entrer",
  "auth.entering": "Connexion…",
  "auth.creating": "Création…",
  "auth.or": "ou",
  "auth.google": "Continuer avec Google",
  "auth.created": "Compte créé !",
  "auth.check_email": "Vérifiez votre e-mail pour confirmer le compte",
  "auth.invalid": "Données invalides",
  "auth.invalid_email": "E-mail invalide",
  "auth.min_password": "8 caractères minimum",
  "auth.invalid_phone": "Numéro de téléphone invalide",
  "auth.error": "Opération impossible",
  "auth.google_error": "Connexion Google impossible",
  "landing.badge": "Amériques et Europe → Haïti et Rép. dominicaine",
  "landing.title": "Envoyez de l'argent à la maison, sans surprises",
  "landing.subtitle":
    "Taux de change clair, frais visibles avant de payer et suivi en temps réel jusqu'à ce que votre famille reçoive l'argent en Haïti ou en République dominicaine.",
  "landing.cta": "Envoyer de l'argent",
  "landing.have_account": "J'ai déjà un compte",
  "landing.stat_minutes": "Minutes",
  "landing.stat_minutes_desc": "Délai habituel",
  "landing.stat_kyc_desc": "Identité vérifiée",
  "landing.stat_countries": "+30 pays",
  "landing.stat_countries_desc": "D'origine",
  "landing.from": "Depuis",
  "landing.to": "Vers",
  "landing.you_send": "Vous envoyez",
  "landing.rate": "Taux de change",
  "landing.fee": "Frais",
  "landing.total": "Total à payer",
  "landing.unavailable": "Indisponible",
  "landing.family_gets": "Votre famille reçoit",
  "landing.footer": "Lajan Rapid · Transferts vers Haïti et la République dominicaine",
};

const ht: Dict = {
  "app.tagline": "Voye lajan rapid nan Ayiti ak Repiblik Dominikèn",
  "nav.home": "Akèy",
  "nav.send": "Voye",
  "nav.wallet": "Bous",
  "nav.card": "Kat",
  "nav.history": "Istorik",
  "nav.profile": "Pwofil",
  "nav.agent": "Ajan",
  "nav.admin": "Admin",
  "nav.support": "Sipò",
  "nav.account": "Kont mwen",
  "nav.signout": "Dekonekte",
  "common.language": "Lang",
  "auth.signin": "Konekte",
  "auth.signup": "Kreye kont",
  "auth.welcome": "Byenveni",
  "auth.subtitle": "Konekte oswa kreye kont ou nan yon minit.",
  "auth.email": "Imèl",
  "auth.password": "Modpas",
  "auth.fullname": "Non konplè",
  "auth.phone": "Telefòn",
  "auth.country_code": "Peyi",
  "auth.phone_hint": "Chwazi peyi w epi ekri nimewo w san kòd la.",
  "auth.enter": "Antre",
  "auth.entering": "N ap konekte…",
  "auth.creating": "N ap kreye…",
  "auth.or": "oswa",
  "auth.google": "Kontinye ak Google",
  "auth.created": "Kont lan kreye!",
  "auth.check_email": "Gade imèl ou pou konfime kont lan",
  "auth.invalid": "Enfòmasyon pa bon",
  "auth.invalid_email": "Imèl pa valab",
  "auth.min_password": "Omwen 8 karaktè",
  "auth.invalid_phone": "Nimewo telefòn pa valab",
  "auth.error": "Nou pa t kapab fini operasyon an",
  "auth.google_error": "Nou pa t kapab konekte ak Google",
  "landing.badge": "Amerik ak Ewòp → Ayiti ak Rep. Dominikèn",
  "landing.title": "Voye lajan lakay san sipriz",
  "landing.subtitle":
    "To chanj klè, frè ou wè anvan ou peye, ak swivi an tan reyèl jiskaske fanmi w resevwa lajan an ann Ayiti oswa nan Repiblik Dominikèn.",
  "landing.cta": "Voye lajan",
  "landing.have_account": "Mwen gen yon kont deja",
  "landing.stat_minutes": "Minit",
  "landing.stat_minutes_desc": "Livrezon abityèl",
  "landing.stat_kyc_desc": "Idantite verifye",
  "landing.stat_countries": "+30 peyi",
  "landing.stat_countries_desc": "Kote ou voye a soti",
  "landing.from": "Soti",
  "landing.to": "Ale",
  "landing.you_send": "Ou voye",
  "landing.rate": "To chanj",
  "landing.fee": "Frè",
  "landing.total": "Total pou peye",
  "landing.unavailable": "Pa disponib",
  "landing.family_gets": "Fanmi w resevwa",
  "landing.footer": "Lajan Rapid · Transfè nan Ayiti ak Repiblik Dominikèn",
};

const en: Dict = {
  "app.tagline": "Fast transfers to Haiti and the Dominican Republic",
  "nav.home": "Home",
  "nav.send": "Send",
  "nav.wallet": "Wallet",
  "nav.card": "Card",
  "nav.history": "History",
  "nav.profile": "Profile",
  "nav.agent": "Agent",
  "nav.admin": "Admin",
  "nav.support": "Support",
  "nav.account": "My account",
  "nav.signout": "Sign out",
  "common.language": "Language",
  "auth.signin": "Sign in",
  "auth.signup": "Create account",
  "auth.welcome": "Welcome",
  "auth.subtitle": "Sign in or create your account in a minute.",
  "auth.email": "Email",
  "auth.password": "Password",
  "auth.fullname": "Full name",
  "auth.phone": "Phone",
  "auth.country_code": "Country",
  "auth.phone_hint": "Pick your country and type your number, without the code.",
  "auth.enter": "Sign in",
  "auth.entering": "Signing in…",
  "auth.creating": "Creating…",
  "auth.or": "or",
  "auth.google": "Continue with Google",
  "auth.created": "Account created!",
  "auth.check_email": "Check your email to confirm the account",
  "auth.invalid": "Invalid data",
  "auth.invalid_email": "Invalid email",
  "auth.min_password": "At least 8 characters",
  "auth.invalid_phone": "Invalid phone number",
  "auth.error": "We couldn't complete the operation",
  "auth.google_error": "We couldn't connect with Google",
  "landing.badge": "Americas & Europe → Haiti and Dominican Rep.",
  "landing.title": "Send money home with no surprises",
  "landing.subtitle":
    "Clear exchange rate, fees shown before you pay and real-time tracking until your family receives the money in Haiti or the Dominican Republic.",
  "landing.cta": "Send money",
  "landing.have_account": "I already have an account",
  "landing.stat_minutes": "Minutes",
  "landing.stat_minutes_desc": "Typical delivery",
  "landing.stat_kyc_desc": "Verified identity",
  "landing.stat_countries": "+30 countries",
  "landing.stat_countries_desc": "Sending from",
  "landing.from": "From",
  "landing.to": "To",
  "landing.you_send": "You send",
  "landing.rate": "Exchange rate",
  "landing.fee": "Fee",
  "landing.total": "Total to pay",
  "landing.unavailable": "Unavailable",
  "landing.family_gets": "Your family receives",
  "landing.footer": "Lajan Rapid · Remittances to Haiti and the Dominican Republic",
};

const DICTS: Record<Lang, Dict> = { es, fr, ht, en };

const STORAGE_KEY = "lajan.lang";

type Ctx = { lang: Lang; setLang: (l: Lang) => void; t: (key: string) => string };

const I18nContext = createContext<Ctx>({ lang: "es", setLang: () => {}, t: (k) => es[k] ?? k });

function detect(): Lang {
  if (typeof window === "undefined") return "es";
  const saved = window.localStorage.getItem(STORAGE_KEY) as Lang | null;
  if (saved && saved in DICTS) return saved;
  const nav = window.navigator.language.slice(0, 2).toLowerCase();
  if (nav in DICTS) return nav as Lang;
  return "es";
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("es");

  useEffect(() => {
    setLangState(detect());
  }, []);

  useEffect(() => {
    if (typeof document !== "undefined") document.documentElement.lang = lang;
  }, [lang]);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    if (typeof window !== "undefined") window.localStorage.setItem(STORAGE_KEY, l);
  }, []);

  const t = useCallback((key: string) => DICTS[lang][key] ?? es[key] ?? key, [lang]);

  const value = useMemo(() => ({ lang, setLang, t }), [lang, setLang, t]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  return useContext(I18nContext);
}
