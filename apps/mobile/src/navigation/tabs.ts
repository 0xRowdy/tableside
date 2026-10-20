import { Bookmark, CircleEllipsis, Hash, House, Spade, Users, type LucideIcon } from 'lucide-react-native';

export interface TabDefinition {
  name: string;
  href: '/' | '/play' | '/counting' | '/community' | '/saved' | '/more';
  label: string;
  icon: LucideIcon;
  /** SF Symbol for the iOS Large Content Viewer. */
  systemImage: string;
}

/** The six global destinations, in tab-bar order. The tab bar is the only primary navigation. */
export const TABS: readonly TabDefinition[] = [
  { name: 'index', href: '/', label: 'Home', icon: House, systemImage: 'house' },
  { name: 'play', href: '/play', label: 'Play', icon: Spade, systemImage: 'suit.spade' },
  { name: 'counting', href: '/counting', label: 'Counting', icon: Hash, systemImage: 'number' },
  { name: 'community', href: '/community', label: 'Community', icon: Users, systemImage: 'person.2' },
  { name: 'saved', href: '/saved', label: 'Saved', icon: Bookmark, systemImage: 'bookmark' },
  { name: 'more', href: '/more', label: 'More', icon: CircleEllipsis, systemImage: 'ellipsis.circle' },
];
