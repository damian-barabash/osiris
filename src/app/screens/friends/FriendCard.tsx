// Карточка друга: аватар, имя, настроение (если делится), что делает сейчас. Число над аватаром — неотвеченные приглашения в его события.
import { tr } from "@/i18n";
import { Card, Icon } from "@/ui";
import { useFriends, type Friend } from "../../data/friends";
import { nav } from "../../router";
import { InvitePopups } from "./invites";
import { FriendAvatar, FriendMood, friendNow } from "./parts";

const COLORS = ["sage", "lavender", "peach", "sky", "butter", "blush"];
const seedOf = (id: string) => { let h = 0; for (let k = 0; k < id.length; k++) h = (h * 31 + id.charCodeAt(k)) & 0xff; return h; };

export function FriendCard({ friend: f, index, compact = false }: { friend: Friend; index: number; compact?: boolean }) {
  const fr = useFriends();
  const n = fr.invitesFrom(f.id).length;
  return (
    <Card color={COLORS[index % COLORS.length]} seed={seedOf(f.id)} padding={compact ? 12 : 14} className={`fr-card${compact ? " compact" : ""}`} onClick={() => nav("/friend/" + f.id)}>
      <span className="fr-card-ava">
        <FriendAvatar friend={f} size={compact ? 40 : 50} />
        {n > 0 && (
          <button type="button" className="count fr-card-badge" aria-label={tr("Приглашения · {0}", [n])} title={tr("Приглашения · {0}", [n])}
            onClick={(e) => { e.stopPropagation(); void InvitePopups.showFrom(f.id); }} onKeyDown={(e) => e.stopPropagation()}>{n}</button>
        )}
      </span>
      <span className="fr-card-text">
        <b>{f.name}</b>
        <FriendMood friend={f} size={compact ? 12 : 13} />
        <em>{friendNow(f)}</em>
      </span>
      {!compact && <Icon name="right" size={18} className="fr-card-go" />}
    </Card>
  );
}
