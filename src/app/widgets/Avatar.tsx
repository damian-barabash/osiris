// Аватар: фото из приватного бакета avatars (`<uid>/avatar.jpg`) с тёплым «бумажным» фильтром, либо инициал на листе.
import { useEffect, useState } from "react";
import { sb } from "../sb";
import { useStore } from "../data/store";

const cache = new Map<string, string | null>();

/** Подписанная ссылка на фото (час), с кэшем. Неудачу не запоминаем — фото могло появиться позже. */
export async function avatarUrl(path: string | null | undefined): Promise<string | null> {
  if (!path) return null;
  const hit = cache.get(path);
  if (hit) return hit;
  const { data } = await sb.storage.from("avatars").createSignedUrl(path, 3600);
  if (data?.signedUrl) cache.set(path, data.signedUrl);
  return data?.signedUrl ?? null;
}
export const forgetAvatar = (path: string) => void cache.delete(path);

export function AvatarView({ url, name, size = 44, color = "var(--lavender)" }: { url: string | null; name: string; size?: number; color?: string }) {
  return (
    <span className="avatar" style={{ width: size, height: size, background: color, fontSize: size * 0.42 }} aria-hidden>
      {url ? <img src={url} alt="" width={size} height={size} loading="lazy" /> : (name.trim()[0] ?? "•").toUpperCase()}
    </span>
  );
}

/** Мой аватар. */
export function PaperAvatar({ size = 44 }: { size?: number }) {
  const s = useStore();
  const path = s.profile?.avatarPath ?? null;
  const [url, setUrl] = useState<string | null>(path ? cache.get(path) ?? null : null);
  useEffect(() => {
    let live = true;
    void avatarUrl(path).then((u) => live && setUrl(u));
    return () => { live = false; };
  }, [path, s.profile?.raw.updated_at]);
  return <AvatarView url={url} name={s.profile?.name ?? ""} size={size} />;
}
