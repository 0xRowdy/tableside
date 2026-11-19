import { Bookmark, CircleEllipsis, Hash, House, Spade, type LucideIcon } from 'lucide-react-native';

export interface TabDefinition {
  name: string;
  href: '/' | '/play' | '/counting' | '/saved' | '/more';
  label: string;
  icon: LucideIcon;
  systemImage: string;
}

// Spec 2 Amendment 10 §1
export const TABS: readonly TabDefinition[] = [
  { name: 'index', href: '/', label: 'Home', icon: House, systemImage: 'house' },
  { name: 'play', href: '/play', label: 'Play', icon: Spade, systemImage: 'suit.spade' },
  { name: 'counting', href: '/counting', label: 'Counting', icon: Hash, systemImage: 'number' },
  { name: 'saved', href: '/saved', label: 'Saved', icon: Bookmark, systemImage: 'bookmark' },
  { name: 'more', href: '/more', label: 'More', icon: CircleEllipsis, systemImage: 'ellipsis.circle' },
];
