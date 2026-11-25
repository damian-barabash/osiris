// Значки. Имена — как в приложении (iconFor в app/lib/widgets/ui.dart): они хранятся в базе у проектов, целей и работ.
import {
  Star, CircleDollarSign, Gavel, Heart, Trash2, Plane, House, Car, BookOpen, Flame, Sparkles, Sun, Flag, User, Folder, CircleCheck, Calendar, CirclePlus, FileText, Lightbulb,
  Briefcase, Camera, Video, Film, Music, Mic, Headphones, Paintbrush, Pencil, Scissors, WandSparkles, Code, Laptop, Smartphone, Tv, Printer, Globe, Rocket, ChartColumn, Percent,
  CreditCard, ShoppingCart, ShoppingBag, Gift, Tag, Ticket, Building2, Users, MessageCircle, Send, Bell, Shield, Lock, Wrench, Box, Gamepad2, Trophy, Zap, Moon, Cloud, Droplet,
  TreePine, PawPrint, Pill, Bandage, Smile, Hand, Map as MapIcon, MapPin, Bus, TramFront, Clock, Hourglass, Target,
  ChevronLeft, ChevronRight, ChevronDown, ChevronUp, X, Plus, Check, Search, Settings, Repeat, Pin, Ellipsis, ArrowRight, ArrowLeft, Download, Upload, Share2, Copy, Eye, EyeOff,
  LogOut, Menu, PanelLeftClose, PanelLeftOpen, SunMedium, StickyNote, Play, Square, Pause, FileDown, Mail, Phone, Link, Filter, RefreshCw, CircleAlert, Info, Languages, Image, Archive,
  LayoutList, CalendarDays, CalendarRange, Grid3x3, Timer, Wallet, TrendingUp, UserPlus, BellOff, Paperclip, CornerDownLeft, ListTodo, CircleHelp, ExternalLink, Minus, GripVertical, CircleArrowUp, CircleArrowDown, ArchiveRestore,
  UserX, TrendingDown,
  type LucideIcon,
} from "lucide-react";
import { Layers, Circle, SquareCheck } from "lucide-react";
import { ArrowDown } from "lucide-react";
import { ArrowUp } from "lucide-react";

const MAP: Record<string, LucideIcon> = {
  // значки из базы
  star: Star, coin: CircleDollarSign, scale: Gavel, heart: Heart, trash: Trash2, plane: Plane, home: House, car: Car, book: BookOpen, run: Flame, spark: Sparkles, sun: Sun, flag: Flag,
  person: User, folder: Folder, check: CircleCheck, calendar: Calendar, plus: CirclePlus, note: FileText, brain: Lightbulb, briefcase: Briefcase, camera: Camera, video: Video, film: Film,
  music: Music, mic: Mic, headphones: Headphones, paint: Paintbrush, pencil: Pencil, scissors: Scissors, wand: WandSparkles, code: Code, laptop: Laptop, phone: Smartphone, tv: Tv,
  printer: Printer, globe: Globe, rocket: Rocket, chart: ChartColumn, percent: Percent, card: CreditCard, cart: ShoppingCart, bag: ShoppingBag, gift: Gift, tag: Tag, ticket: Ticket,
  building: Building2, team: Users, chat: MessageCircle, send: Send, bell: Bell, shield: Shield, lock: Lock, wrench: Wrench, cube: Box, game: Gamepad2, sport: Trophy, bolt: Zap, moon: Moon,
  cloud: Cloud, drop: Droplet, tree: TreePine, paw: PawPrint, pill: Pill, bandage: Bandage, smile: Smile, hand: Hand, map: MapIcon, pin: MapPin, bus: Bus, tram: TramFront, clock: Clock,
  hourglass: Hourglass, target: Target,
  // значки интерфейса
  back: ChevronLeft, left: ChevronLeft, right: ChevronRight, down: ChevronDown, up: ChevronUp, close: X, add: Plus, tick: Check, search: Search, settings: Settings, repeat: Repeat,
  pinned: Pin, more: Ellipsis, "arrow-right": ArrowRight, "arrow-left": ArrowLeft, "arrow-down": ArrowDown, download: Download, upload: Upload, share: Share2, copy: Copy, eye: Eye, "eye-off": EyeOff, logout: LogOut,
  menu: Menu, "panel-close": PanelLeftClose, "panel-open": PanelLeftOpen, today: SunMedium, notes: StickyNote, play: Play, stop: Square, pause: Pause, pdf: FileDown, mail: Mail, call: Phone,
  link: Link, filter: Filter, refresh: RefreshCw, alert: CircleAlert, info: Info, lang: Languages, image: Image, archive: Archive, list: LayoutList, week: CalendarRange, month: CalendarDays,
  year: Grid3x3, timer: Timer, wallet: Wallet, trend: TrendingUp, "user-plus": UserPlus, "bell-off": BellOff, clip: Paperclip, enter: CornerDownLeft, tasks: ListTodo, help: CircleHelp,
  external: ExternalLink, minus: Minus, grip: GripVertical, users: Users, user: User, "user-x": UserX, "trend-down": TrendingDown,
  stack: Layers, circle: Circle, square: Square, "check-square": SquareCheck,
  "arrow-up": ArrowUp,
  "arrow-up-circle": CircleArrowUp, "arrow-down-circle": CircleArrowDown, unarchive: ArchiveRestore,
};

/** 66 значков для выбора у целей, проектов и работ — порядок как в приложении (trackerIcons). */
export const trackerIcons = ["star", "flag", "target", "heart", "coin", "card", "chart", "percent", "scale", "home", "car", "plane", "bus", "tram", "map", "pin", "briefcase", "building", "team", "chat", "send", "bell", "book", "pencil", "paint", "scissors", "wand", "code", "laptop", "phone", "tv", "printer", "globe", "rocket", "camera", "video", "film", "music", "mic", "headphones", "cart", "bag", "gift", "tag", "ticket", "game", "sport", "run", "bolt", "spark", "sun", "moon", "cloud", "drop", "tree", "paw", "pill", "bandage", "smile", "hand", "shield", "lock", "wrench", "cube", "clock", "hourglass"];
export const projectIcons = trackerIcons;

export function Icon({ name, size = 18, color, fill = false, strokeWidth = 2.2, className }: { name: string; size?: number; color?: string; fill?: boolean; strokeWidth?: number; className?: string }) {
  const C = MAP[name] ?? Star;
  return <C aria-hidden size={size} color={color} strokeWidth={strokeWidth} fill={fill ? "currentColor" : "none"} className={className} style={{ flex: "none" }} />;
}
