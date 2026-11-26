// Публичные параметры. Publishable-ключ Supabase можно хранить в коде: доступ ограничен RLS.
export const SITE_URL = "https://myosiris.app";
export const SUPABASE_URL = "https://wdxxxuxsgqsvqdkvbhye.supabase.co";
export const SUPABASE_KEY = "sb_publishable_NU2mB-R6ue38Z_59aIUuFg_4H4Isw8e";
export const FN = `${SUPABASE_URL}/functions/v1`;
export const CONTACT_EMAIL = "dbdcstudio@gmail.com";
/** Версия веб-версии = версия приложения, с которой она сверена (правило: обновили приложение — обновили сайт). */
export const WEB_VERSION = "1.13.2";
/** Вход через Google в вебе. Включить (true), когда в Supabase → Auth → Google вписан client secret веб-клиента. */
export const GOOGLE_WEB = true;
/** Вход через Apple в вебе. Включить (true), когда в Apple Developer создан Services ID и он вписан в Supabase → Auth → Apple. */
export const APPLE_WEB = false;
